import { spawnSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = join(root, ".local-demo");
const mode = process.argv[2];
if (!["dev", "reset", "seed"].includes(mode)) {
  throw new Error("Usage: node scripts/demo.mjs dev|reset|seed");
}
if (process.env.NODE_ENV && process.env.NODE_ENV !== "development") {
  throw new Error("Demo commands are only allowed in development.");
}
if (mode === "reset" && existsSync(join(root, ".next/dev/lock"))) {
  throw new Error(
    "Stop the development server before resetting the demo database.",
  );
}
mkdirSync(directory, { recursive: true });
const secretPath = join(directory, "jwt-secret");
if (!existsSync(secretPath)) {
  writeFileSync(secretPath, randomBytes(32).toString("base64url"), {
    mode: 0o600,
    flag: "wx",
  });
}
// Explicit overrides isolate all commands from DATABASE_URL/JWT_SECRET in .env.
const env = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: `file:${join(directory, "demo.db")}`,
  JWT_SECRET: readFileSync(secretPath, "utf8").trim(),
  LOCAL_AUTH_BYPASS: "true",
};
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const prismaCli = join(root, "node_modules/prisma/build/index.js");
run(prismaCli, ["generate"]);
run(
  prismaCli,
  mode === "reset" ? ["migrate", "reset", "--force"] : ["migrate", "deploy"],
);

Object.assign(process.env, env);
const { PrismaClient } = await import("../generated/prisma/client.ts");
const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
const { seedDemo } = await import("./demo/seed.ts");
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: env.DATABASE_URL }),
});
try {
  const created = await seedDemo(prisma);
  console.log(created ? "Demo data created." : "Existing demo data preserved.");
} finally {
  await prisma.$disconnect();
}
console.log(
  "Demo login: demo@example.test (also anna@example.test, lukas@example.test)",
);
console.log("Code: 123456 — no email sent. Database: .local-demo/demo.db");
if (mode === "dev") {
  const child = spawn(
    process.execPath,
    [
      join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      ...process.argv.slice(3),
    ],
    { cwd: root, env, stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
}
