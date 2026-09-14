import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// Only the framework navigation boundary is stubbed; use the real action and DB.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/navigation") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export function redirect(path) { throw new Error('redirect:' + path); }",
      };
    }
    return nextResolve(specifier, context);
  },
});

test("setup persists supported ward languages and rejects invalid input", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wardly-setup-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
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
  const { setupInitialWard } = await import("./actions.ts");
  const form = (locale) => {
    const data = new FormData();
    data.set("wardName", "Test ward");
    data.set("userName", "Test user");
    data.set("userEmail", "test@example.com");
    if (locale !== undefined) data.set("contentLocale", locale);
    return data;
  };
  try {
    for (const locale of [undefined, "fr", "de-CH", ""]) {
      await assert.rejects(
        setupInitialWard(form(locale)),
        /supported ward language/,
      );
      assert.equal(await prisma.ward.count(), 0);
      assert.equal(await prisma.user.count(), 0);
    }
    for (const locale of ["en", "de"]) {
      await assert.rejects(setupInitialWard(form(locale)), /redirect:\/login/);
      const ward = await prisma.ward.findFirstOrThrow();
      assert.equal(ward.content_locale, locale);
      assert.equal(await prisma.user.count(), 1);
      await assert.rejects(
        setupInitialWard(form(locale)),
        /already been completed/,
      );
      await prisma.ward.deleteMany();
    }
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
