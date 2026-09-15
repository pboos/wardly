import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { localAuthBypassEnabled } from "../../lib/auth/local-development.ts";
import {
  LOCAL_LOGIN_CODE,
  LOGIN_TTL_MS,
  MAX_LOGIN_ATTEMPTS,
  SESSION_COOKIE_NAME,
} from "../../lib/auth/constants.ts";

globalThis.loginTest = { emails: [], cookies: [] };
registerHooks({
  resolve(specifier, context, nextResolve) {
    const stubs = {
      "server-only": "export {};",
      "next/navigation":
        "export function redirect(path) { throw new Error('redirect:' + path); }",
      "next/headers":
        "export async function cookies() { return { set(...args) { globalThis.loginTest.cookies.push(args); } }; }",
      "@/lib/email":
        "export async function sendLoginEmail(opts) { globalThis.loginTest.emails.push(opts); }",
    };
    if (specifier in stubs)
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`,
      };
    return nextResolve(specifier, context);
  },
});

test("local login uses real hashed codes and sessions, skips email, and enforces normal guards", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wardly-login-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
  const db = new Database(join(directory, "test.db"));
  db.exec(
    readFileSync(
      new URL(
        "../../prisma/migrations/20260627162827_init/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  db.close();
  const { prisma } = await import("../../lib/prisma.ts");
  const { requestLogin, verifyCode } = await import("./actions.ts");
  const { verifyJwt } = await import("../../lib/auth/session.ts");
  const form = (email, code) => {
    const data = new FormData();
    data.set("email", email);
    data.set("redirect", "/members");
    if (code) data.set("code", code);
    return data;
  };
  const idle = { status: "idle" };
  try {
    process.env.LOCAL_AUTH_BYPASS = "true";
    for (const env of ["production", "test", ""]) {
      process.env.NODE_ENV = env;
      assert.throws(localAuthBypassEnabled, /only allowed in development/);
      await assert.rejects(
        requestLogin(idle, form("demo@example.test")),
        /only allowed in development/,
      );
      await assert.rejects(
        verifyCode(idle, form("demo@example.test", LOCAL_LOGIN_CODE)),
        /only allowed in development/,
      );
    }
    process.env.NODE_ENV = "development";
    const ward = await prisma.ward.create({ data: { name: "Test" } });
    const user = await prisma.user.create({
      data: { ward_id: ward.id, name: "Demo", email: "demo@example.test" },
    });
    const request = () => requestLogin(idle, form(user.email));
    const verify = (code = LOCAL_LOGIN_CODE) =>
      verifyCode(idle, form(user.email, code));
    assert.equal((await verify()).status, "error"); // A request is still required.
    assert.equal((await request()).status, "email_sent");
    const login = await prisma.login.findUniqueOrThrow({
      where: { user_id: user.id },
    });
    assert.notEqual(login.code_hash, LOCAL_LOGIN_CODE);
    assert.equal(globalThis.loginTest.emails.length, 0);
    await assert.rejects(verify(), /redirect:\/members/);
    assert.equal(await prisma.login.count(), 0);
    const [name, token, options] = globalThis.loginTest.cookies[0];
    assert.equal(name, SESSION_COOKIE_NAME);
    assert.equal(options.httpOnly, true);
    assert.equal((await verifyJwt(token)).sub, user.id);
    assert.equal((await verify()).status, "error"); // Single-use.
    await request();
    for (let attempt = 0; attempt < MAX_LOGIN_ATTEMPTS; attempt++)
      assert.equal((await verify("WRONG!")).status, "error");
    assert.equal(await prisma.login.count(), 0);
    await request();
    await prisma.login.update({
      where: { user_id: user.id },
      data: { created_at: new Date(Date.now() - LOGIN_TTL_MS - 1000) },
    });
    assert.equal((await verify()).status, "error");
    await requestLogin(idle, form("missing@example.test"));
    assert.equal(
      (await verifyCode(idle, form("missing@example.test", LOCAL_LOGIN_CODE)))
        .status,
      "error",
    );
    await request();
    process.env.LOCAL_AUTH_BYPASS = "false";
    process.env.NODE_ENV = "production";
    assert.equal((await verify()).status, "error"); // Old local codes cannot survive switching modes.
    await request();
    assert.equal(globalThis.loginTest.emails.length, 1);
    assert.notEqual(globalThis.loginTest.emails[0].code, LOCAL_LOGIN_CODE);
    await assert.rejects(
      verify(globalThis.loginTest.emails[0].code),
      /redirect:\/members/,
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
