import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Sunday ordering persists and reloads consistently against the initial migration", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--import",
      new URL("./test-support/register.mjs", import.meta.url).href,
      new URL("./test-support/persistence.mjs", import.meta.url).pathname,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
