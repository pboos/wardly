import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./lib/tasks/reminder-scheduler")
      return {
        shortCircuit: true,
        url: "data:text/javascript,export function startTaskReminderScheduler() { globalThis.reminderStarts = (globalThis.reminderStarts || 0) + 1; }",
      };
    return nextResolve(specifier, context);
  },
});

test("startup only enables the scheduler in approved runtime environments", async () => {
  const { register } = await import("../../instrumentation.ts");
  const keys = [
    "NEXT_RUNTIME",
    "NEXT_PHASE",
    "NODE_ENV",
    "LOCAL_AUTH_BYPASS",
    "TASK_REMINDERS_ENABLED",
  ];
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    for (const [overrides, starts] of [
      [{}, true],
      [{ NODE_ENV: "development" }, false],
      [{ NODE_ENV: "development", TASK_REMINDERS_ENABLED: "true" }, true],
      [{ TASK_REMINDERS_ENABLED: "false" }, false],
      [
        {
          NEXT_PHASE: "phase-production-build",
          TASK_REMINDERS_ENABLED: "true",
        },
        false,
      ],
      [{ NEXT_RUNTIME: "edge" }, false],
      [{ LOCAL_AUTH_BYPASS: "true", TASK_REMINDERS_ENABLED: "true" }, false],
    ]) {
      for (const key of keys) delete process.env[key];
      Object.assign(
        process.env,
        { NODE_ENV: "production", NEXT_RUNTIME: "nodejs" },
        overrides,
      );
      globalThis.reminderStarts = 0;
      await register();
      assert.equal(
        globalThis.reminderStarts,
        starts ? 1 : 0,
        JSON.stringify(overrides),
      );
    }
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
