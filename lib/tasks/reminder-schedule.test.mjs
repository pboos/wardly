import assert from "node:assert/strict";
import test from "node:test";
import {
  dueSunday,
  meetingInstant,
  isMeetingTime,
  isIanaTimeZone,
} from "./reminder-schedule.ts";
import { renderTaskDigest } from "./reminder-email.ts";

test("reminders use ward time, catch up before meeting, and stop at meeting start", () => {
  const due = (iso) => dueSunday("Europe/Zurich", "09:00", new Date(iso));
  assert.equal(due("2026-09-20T05:59:59Z"), null);
  assert.equal(due("2026-09-20T06:00:00Z"), "2026-09-20");
  assert.equal(due("2026-09-20T06:59:59Z"), "2026-09-20");
  assert.equal(due("2026-09-20T07:00:00Z"), null);
  assert.equal(due("2026-09-21T06:00:00Z"), null);
  assert.equal(dueSunday("Europe/Zurich", null, new Date()), null);
  assert.equal(dueSunday("Mars/Base", "09:00", new Date()), null);
});

test("DST, fractional offsets and a reminder crossing Saturday midnight", () => {
  for (const [zone, date, time, expected] of [
    ["Europe/Zurich", "2026-03-29", "09:00", "2026-03-29T07:00:00Z"],
    ["Europe/Zurich", "2026-10-25", "09:00", "2026-10-25T08:00:00Z"],
    ["America/Denver", "2026-03-08", "09:00", "2026-03-08T15:00:00Z"],
    ["America/Denver", "2026-11-01", "09:00", "2026-11-01T16:00:00Z"],
    ["Asia/Kathmandu", "2026-09-20", "09:00", "2026-09-20T03:15:00Z"],
    ["Europe/Zurich", "2026-10-25", "02:30", "2026-10-25T00:30:00Z"],
  ]) {
    assert.equal(meetingInstant(date, time, zone), Date.parse(expected));
    assert.equal(
      dueSunday(zone, time, new Date(Date.parse(expected) - 3600000)),
      date,
    );
  }
  assert.equal(meetingInstant("2026-03-29", "02:30", "Europe/Zurich"), null);
  assert.equal(
    dueSunday("UTC", "00:30", new Date("2026-09-19T23:30:00Z")),
    "2026-09-20",
  );
});

test("setup validators reject malformed times and offset-only zones", () => {
  for (const time of ["9:00", "24:00", "09:60", "", null])
    assert.equal(isMeetingTime(time), false);
  assert.equal(isMeetingTime("00:00"), true);
  assert.equal(isMeetingTime("23:59"), true);
  for (const zone of ["", "+02:00", "Mars/Base", null])
    assert.equal(isIanaTimeZone(zone), false);
  assert.equal(isIanaTimeZone("Europe/Berlin"), true);
});

test("email includes every task, details and authenticated task link; HTML is escaped", () => {
  const email = renderTaskDigest({
    to: "test@example.com",
    name: "<Admin>",
    wardName: "A & B",
    sundayDate: "2026-09-20",
    meetingTime: "09:00",
    timeZone: "UTC",
    tasksUrl: "https://ward.test/tasks?filter=mine",
    tasks: [
      {
        type: "Task",
        state: "Todo",
        title: '<script>alert("x")</script>',
        description: "Discuss & follow up",
        member: { first_name: "Jane", last_name: "Doe" },
        priority: "urgent",
        due_date: "2026-09-21",
      },
    ],
  });
  assert.match(email.text, /Jane Doe/);
  assert.match(email.text, /Due: 2026-09-21/);
  assert.match(email.html, /https:\/\/ward.test\/tasks\?filter=mine/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
});
