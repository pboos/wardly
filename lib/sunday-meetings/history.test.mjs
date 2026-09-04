import assert from "node:assert/strict";
import test from "node:test";
import { buildSundayMeetingMemberHistory } from "./history.ts";
import { isSundayMeetingType } from "./types.ts";

const member = (id, first_name = id, last_name = "Member") => ({
  id,
  first_name,
  last_name,
  status: "active",
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

  assert.deepEqual(result.lastTalk, { date: "2025-01-05", meetingType: "fast_testimony" });
  assert.deepEqual(result.nextTalk, { date: "2025-02-02", meetingType: "sacrament" });
  assert.deepEqual(result.lastPrayer, { date: "2025-01-12", meetingType: "sacrament" });
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

  assert.deepEqual(results.map(({ id }) => id), ["m2", "m1"]);
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
