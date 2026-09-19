#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const scenario = process.argv[2];
if (!scenario || scenario === "--help") {
  console.log(`Usage: node run-check.mjs /path/to/scenario.mjs
Optional env: UI_CHECK_RUNTIME, UI_CHECK_URL, UI_CHECK_OUTPUT, UI_CHECK_EXECUTABLE, UI_CHECK_LIBRARY_PATH`);
  process.exit(scenario ? 0 : 1);
}
const runtime = resolve(process.env.UI_CHECK_RUNTIME ??
  ["/tmp/codex-ui-check", "/tmp/wardly-tag-ui"].find(path =>
    existsSync(join(path, "node_modules/@playwright/test"))) ?? "/tmp/codex-ui-check");
if (!existsSync(join(runtime, "node_modules/@playwright/test"))) {
  throw new Error(`Playwright not found under ${runtime}. Follow references/runtime.md or set UI_CHECK_RUNTIME.`);
}
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(join(runtime, "browsers"))) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = join(runtime, "browsers");
}
const requireRuntime = createRequire(join(runtime, "package.json"));
const { chromium, expect } = requireRuntime("@playwright/test");
const baseURL = process.env.UI_CHECK_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("This runner targets a local app; use the project's authorized harness for remote environments.");
}
const outputDir = resolve(process.env.UI_CHECK_OUTPUT ??
  join(runtime, "runs", new Date().toISOString().replaceAll(":", "-")));
await mkdir(outputDir, { recursive: true, mode: 0o700 });
const libraryRoot = join(runtime, "libs/usr/lib");
const unpacked = existsSync(libraryRoot) ? [
  libraryRoot,
  ...readdirSync(libraryRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(libraryRoot, entry.name)),
] : [];
const libraryPath = [process.env.UI_CHECK_LIBRARY_PATH, ...unpacked, process.env.LD_LIBRARY_PATH]
  .filter(Boolean).join(":");
const diagnostics = { pageErrors: [], failedRequests: [] };
let browser;
let page;
let success = false;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.UI_CHECK_EXECUTABLE ? { executablePath: process.env.UI_CHECK_EXECUTABLE } : {}),
    env: { ...process.env, ...(libraryPath ? { LD_LIBRARY_PATH: libraryPath } : {}) },
  });
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  page.on("pageerror", error => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", request => {
    const url = new URL(request.url());
    // Omit query strings, cookies, request bodies, and authentication headers.
    diagnostics.failedRequests.push({
      method: request.method(), path: url.origin + url.pathname,
      error: request.failure()?.errorText,
    });
  });
  const module = await import(pathToFileURL(resolve(scenario)).href);
  if (typeof module.default !== "function") throw new Error("Scenario must export a default async function.");
  await module.default({ page, context, browser, expect, baseURL, outputDir });
  success = true;
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(outputDir, "failure.png"), fullPage: true }).catch(() => {});
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(join(outputDir, "diagnostics.json"), JSON.stringify(diagnostics, null, 2), { mode: 0o600 });
  await browser?.close();
}
console.log(`${success ? "PASS" : "FAIL"} — artifacts: ${outputDir}`);
if (diagnostics.pageErrors.length || diagnostics.failedRequests.length) {
  console.log("Review diagnostics.json; some failures may be expected by the scenario.");
}
