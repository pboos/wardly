import assert from "node:assert/strict";
import test from "node:test";
import {
  SUNDAY_SCHEDULE_POLICY,
  getScheduleBoundaryVisibility,
  shouldFallbackToDefaultSchedule,
  safeSundayCursor,
} from "./schedule.ts";
import { previousSunday } from "./calendar.ts";

test("shared schedule policy preserves prior/current and page limits", () => {
  assert.equal(SUNDAY_SCHEDULE_POLICY.priorLimit, 3);
  assert.equal(SUNDAY_SCHEDULE_POLICY.currentLimit, 12);
  assert.equal(SUNDAY_SCHEDULE_POLICY.cursorPageLimit, 16);
  assert.equal(
    SUNDAY_SCHEDULE_POLICY.priorLimit + SUNDAY_SCHEDULE_POLICY.currentLimit,
    15,
  );
});

test("out-of-range cursor pages fall back only when persisted data exists", () => {
  assert.equal(shouldFallbackToDefaultSchedule(0, true, true), true);
  assert.equal(shouldFallbackToDefaultSchedule(0, false, true), false);
  assert.equal(shouldFallbackToDefaultSchedule(1, true, true), false);
});

test("the earlier boundary is exactly one Sunday before the earliest record", () => {
  assert.equal(previousSunday("2025-02-02"), "2025-01-26");
});

test("schedule cursors accept only real Sunday dates", () => {
  assert.equal(safeSundayCursor("2025-02-02"), "2025-02-02");
  assert.equal(safeSundayCursor("2025-02-03"), undefined);
  assert.equal(safeSundayCursor("not-a-date"), undefined);
});

test("the first persisted page shows only the before boundary action", () => {
  assert.deepEqual(
    getScheduleBoundaryVisibility(
      ["2025-01-05", "2025-01-12"],
      "2025-01-05",
      "2025-03-30",
    ),
    { hasEarlier: false, hasLater: true, showBefore: true, showAfter: false },
  );
});

test("a middle persisted page shows neither boundary action", () => {
  assert.deepEqual(
    getScheduleBoundaryVisibility(
      ["2025-02-02", "2025-02-09"],
      "2025-01-05",
      "2025-03-30",
    ),
    { hasEarlier: true, hasLater: true, showBefore: false, showAfter: false },
  );
});

test("the last persisted page shows only the after boundary action", () => {
  assert.deepEqual(
    getScheduleBoundaryVisibility(
      ["2025-03-23", "2025-03-30"],
      "2025-01-05",
      "2025-03-30",
    ),
    { hasEarlier: true, hasLater: false, showBefore: false, showAfter: true },
  );
});

test("a one-page persisted schedule shows both boundary actions", () => {
  assert.deepEqual(
    getScheduleBoundaryVisibility(["2025-02-02"], "2025-02-02", "2025-02-02"),
    { hasEarlier: false, hasLater: false, showBefore: true, showAfter: true },
  );
});

test("an empty selection shows neither boundary action", () => {
  assert.deepEqual(
    getScheduleBoundaryVisibility([], "2025-01-05", "2025-03-30"),
    { hasEarlier: false, hasLater: false, showBefore: false, showAfter: false },
  );
});
