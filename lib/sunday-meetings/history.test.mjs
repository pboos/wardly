import assert from "node:assert/strict";
import test from "node:test";
import { buildSundayMeetingMemberHistory, buildSundayAssignmentHistoryRows } from "./history.ts";
import { isSundayMeetingType } from "./types.ts";

const member = (id, first_name = id, last_name = "Member") => ({
  id,
  first_name,
  last_name,
  is_moved_out: false,
});

const item = (memberId, type, date, meetingType = "sacrament") => ({
  memberId,
  type,
  sunday_meeting: { date, type: meetingType },
});

test("history uses strict past and inclusive future boundaries", () => {
  const [result] = buildSundayMeetingMemberHistory(
    [member("m1")],
    [
      item("m1", "talk", "2025-01-05", "fast_testimony"),
      item("m1", "talk", "2025-02-02"),
      item("m1", "talk", "2025-02-09"),
      item("m1", "prayer", "2025-01-12"),
    ],
    "2025-02-02",
    isSundayMeetingType,
  );

  assert.deepEqual(result.lastTalk, {
    date: "2025-01-05",
    meetingType: "fast_testimony",
  });
  assert.deepEqual(result.nextTalk, {
    date: "2025-02-02",
    meetingType: "sacrament",
  });
  assert.deepEqual(result.lastPrayer, {
    date: "2025-01-12",
    meetingType: "sacrament",
  });
  assert.equal(result.nextPrayer, null);
});

test("history preserves nearest-date invalid-type behavior and member ordering", () => {
  const results = buildSundayMeetingMemberHistory(
    [member("m2", "Zed"), member("m1", "Amy")],
    [
      item("m1", "talk", "2025-01-05", "invalid"),
      item("m1", "talk", "2025-01-12", "sacrament"),
      item("m2", "prayer", "2025-02-02", "invalid"),
      item("m2", "prayer", "2025-02-09", "sacrament"),
    ],
    "2025-02-02",
    isSundayMeetingType,
  );

  assert.deepEqual(
    results.map(({ id }) => id),
    ["m2", "m1"],
  );
  assert.equal(results[0].lastTalk, null);
  assert.equal(results[1].nextPrayer, null);
});

test("empty history produces null fields", () => {
  const [result] = buildSundayMeetingMemberHistory(
    [member("m1")],
    [],
    "2025-02-02",
    isSundayMeetingType,
  );

  assert.deepEqual(
    [result.lastTalk, result.nextTalk, result.lastPrayer, result.nextPrayer],
    [null, null, null, null],
  );
});

test("equal-date history keeps the first input item", () => {
  const [result] = buildSundayMeetingMemberHistory(
    [member("m1")],
    [
      item("m1", "talk", "2025-01-26", "invalid"),
      item("m1", "talk", "2025-01-26", "sacrament"),
      item("m1", "prayer", "2025-02-02", "invalid"),
      item("m1", "prayer", "2025-02-02", "sacrament"),
    ],
    "2025-02-02",
    isSundayMeetingType,
  );

  assert.equal(result.lastTalk, null);
  assert.equal(result.nextPrayer, null);
});

test("latest dates include the furthest future assignment independently for each kind", () => {
  const [result] = buildSundayMeetingMemberHistory(
    [member("m1")],
    [
      item("m1", "talk", "2025-05-04"),
      item("m1", "talk", "2025-01-05"),
      item("m1", "talk", "2025-03-02"),
      item("m1", "prayer", "2025-02-02"),
      item("m1", "prayer", "2025-01-12"),
    ],
    "2025-02-02",
    isSundayMeetingType,
  );
  assert.equal(result.latestTalk.date, "2025-05-04");
  assert.equal(result.nextTalk.date, "2025-03-02");
  assert.equal(result.lastTalk.date, "2025-01-05");
  assert.equal(result.latestPrayer.date, "2025-02-02");
});

test("category lists sort oldest first with never first and deterministic name/id ties", () => {
  const history = buildSundayMeetingMemberHistory(
    [member("future"), member("never"), member("b", "Same"), member("a", "Same"), member("old"), member("amy", "Amy")],
    [item("future", "talk", "2025-05-04"), item("future", "talk", "2025-03-02"),
      item("b", "talk", "2025-04-06"), item("a", "talk", "2025-04-06"),
      item("amy", "talk", "2025-04-06"), item("old", "talk", "2025-01-05"),
      item("never", "prayer", "2025-01-12")],
    "2025-02-02", isSundayMeetingType,
  );
  assert.deepEqual(buildSundayAssignmentHistoryRows(history, "talk", true).map(row => row.id),
    ["never", "old", "amy", "a", "b", "future"]);
  assert.deepEqual(buildSundayAssignmentHistoryRows(history, "talk", false).map(row => row.id),
    ["old", "amy", "a", "b", "future"]);
  assert.deepEqual(buildSundayAssignmentHistoryRows(history, "prayer", false).map(row => row.id), ["never"]);
});

test("history lists exclude moved-out and default-excluded members without changing picker history", () => {
  const history = buildSundayMeetingMemberHistory(
    [member("current"), { ...member("moved"), is_moved_out: true }, member("excluded")],
    [], "2025-02-02", isSundayMeetingType,
  ).map(row => row.id === "excluded" ? { ...row, exclusionTags: [{ id: "tag", name: "No contact", color: "gray" }] } : row);
  assert.deepEqual(buildSundayAssignmentHistoryRows(history, "talk", true).map(row => row.id), ["current"]);
  assert.equal(history.length, 3);
  assert.deepEqual(buildSundayAssignmentHistoryRows(history, "prayer", false), []);
});
