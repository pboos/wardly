import test from "node:test";
import assert from "node:assert/strict";
import { datesBetween, parseRule, assignMeeting } from "./calendar.ts";
test("calendar recurrence stays anchored and clamps short months", () => {
  assert.deepEqual(
    datesBetween(
      { version: 1, kind: "months", interval: 1, day: 31 },
      "2027-01-31",
      "2027-01-01",
      "2027-04-30",
    ),
    ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"],
  );
  assert.deepEqual(
    datesBetween(
      { version: 1, kind: "annual", month: 2, day: 29 },
      "2027-01-01",
      "2027-01-01",
      "2028-12-31",
    ),
    ["2027-02-28", "2028-02-29"],
  );
  assert.deepEqual(
    datesBetween(
      { version: 1, kind: "months", interval: 3, day: 10 },
      "2027-01-10",
      "2027-01-10",
      "2027-12-31",
    ),
    ["2027-01-10", "2027-04-10", "2027-07-10", "2027-10-10"],
  );
});
test("weekday and ordinal rules support fifth and last without coercing invalid zero", () => {
  assert.deepEqual(
    datesBetween(
      { version: 1, kind: "ordinal", interval: 1, weekday: 0, ordinal: 5 },
      "2027-01-01",
      "2027-01-01",
      "2027-03-31",
    ),
    ["2027-01-31"],
  );
  assert.deepEqual(
    datesBetween(
      { version: 1, kind: "ordinal", interval: 1, weekday: 0, ordinal: -1 },
      "2027-01-01",
      "2027-01-01",
      "2027-03-31",
    ),
    ["2027-01-31", "2027-02-28", "2027-03-28"],
  );
  assert.throws(() =>
    parseRule({
      version: 1,
      kind: "ordinal",
      interval: 1,
      weekday: 0,
      ordinal: 0,
    }),
  );
  assert.deepEqual(
    datesBetween(
      { version: 1, kind: "weeks", interval: 2, weekday: 0 },
      "2027-01-03",
      "2027-01-03",
      "2027-01-31",
    ),
    ["2027-01-03", "2027-01-17", "2027-01-31"],
  );
});
test("assignment uses last on/before date and never rewrites closed history", () => {
  const meetings = [
    { id: "a", date: "2027-01-10", status: "planned" },
    { id: "b", date: "2027-01-17", status: "planned" },
  ];
  assert.equal(assignMeeting("2027-01-15", meetings)?.id, "a");
  assert.equal(
    assignMeeting("2027-01-15", [
      { ...meetings[0], status: "closed" },
      meetings[1],
    ])?.id,
    "b",
  );
  assert.equal(
    assignMeeting("2027-01-17", [
      { ...meetings[0], status: "active" },
      { ...meetings[1], status: "cancelled" },
    ]),
    undefined,
  );
});

test("weekly intervals start with the first selected weekday on or after the anchor", () => {
  assert.deepEqual(
    datesBetween(
      { version: 1, kind: "weeks", interval: 2, weekday: 0 },
      "2026-10-16",
      "2026-10-16",
      "2026-11-15",
    ),
    ["2026-10-18", "2026-11-01", "2026-11-15"],
  );
});
