import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { scheduleThrough, localToday } from "./calendar.ts";
const directory = mkdtempSync(join(tmpdir(), "wardly-rolling-test-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
const sqlite = new Database(join(directory, "test.db"));
const migrations = new URL("../../prisma/migrations/", import.meta.url);
for (const name of readdirSync(migrations)
  .filter((n) => /^\d/.test(n))
  .sort())
  sqlite.exec(
    readFileSync(new URL(`${name}/migration.sql`, migrations), "utf8"),
  );
sqlite.close();
const { prisma } = await import("../prisma.ts");
const { executeMeetingCommand: execute } = await import("./service.ts");
const { prepareLeadershipMeetings: prepare } = await import("./prepare.ts");
const { loadLeadershipMeeting: load } = await import("./loaders.ts");

test("calendar horizon clamps months and respects ward local today", (t) => {
  assert.equal(scheduleThrough("2026-01-31"), "2026-04-30");
  assert.equal(scheduleThrough("2023-11-30"), "2024-02-29");
  assert.equal(scheduleThrough("2024-11-30"), "2025-02-28");
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-01-31T23:30:00Z"),
  });
  assert.equal(scheduleThrough(localToday("Europe/Zurich")), "2026-05-01");
  assert.equal(
    scheduleThrough(localToday("America/Los_Angeles")),
    "2026-04-30",
  );
});

test("both authenticated pages prepare before loading", () => {
  for (const [page, kind] of [
    ["bishopric", "bishopric"],
    ["ward-council", "ward_council"],
  ]) {
    const source = readFileSync(
      new URL(`../../app/meetings/${page}/page.tsx`, import.meta.url),
      "utf8",
    );
    assert.ok(
      source.indexOf("await getCurrentUser()") <
        source.indexOf("await prepareLeadershipMeetings("),
    );
    assert.ok(
      source.indexOf(
        `await prepareLeadershipMeetings(user.ward_id, "${kind}")`,
      ) < source.indexOf("await loadLeadershipMeeting("),
    );
  }
});

test("opening pages rolls a bounded calendar window and preserves existing records", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-01-31T12:00:00Z"),
  });
  try {
    for (const kind of ["bishopric", "ward_council"]) {
      const ward = await prisma.ward.create({
        data: { name: kind, time_zone: "UTC" },
      });
      await prepare(ward.id, kind);
      assert.equal((await load(ward.id, kind)).series, null);
      await execute(ward.id, {
        kind: "initialize",
        meetingKind: kind,
        anchorDate: "2026-01-31",
        schedule: { version: 1, kind: "weeks", interval: 1, weekday: 0 },
        startTime: "09:00",
        targetMinutes: 60,
      });
      let data = await load(ward.id, kind);
      const seriesId = data.series.id;
      assert.ok(
        data.meetings.every(
          (m) => m.date >= "2026-01-31" && m.date <= "2026-04-30",
        ),
      );
      const future = await prisma.leadership_meeting.create({
        data: {
          series_id: seriesId,
          scheduled_date: "2027-01-03",
          date: "2027-01-03",
          start_time: "09:00",
        },
      });
      const standingId = randomUUID();
      await execute(ward.id, {
        kind: "add",
        meetingId: data.meeting.id,
        requestId: standingId,
        input: {
          title: "Standing",
          durationMinutes: 5,
          anchorDate: data.meeting.date,
          recurrence: { version: 1, kind: "every_meeting" },
        },
      });
      assert.equal((await load(ward.id, kind, future.id)).items.length, 0);
      const annualId = randomUUID();
      await execute(ward.id, {
        kind: "add",
        meetingId: data.meeting.id,
        requestId: annualId,
        input: {
          title: "Annual",
          durationMinutes: 5,
          anchorDate: "2026-05-15",
          recurrence: { version: 1, kind: "annual", month: 5, day: 15 },
        },
      });
      assert.equal(
        await prisma.meeting_agenda_occurrence.count({
          where: { template_id: annualId },
        }),
        0,
      );
      const before = await prisma.leadership_meeting.count({
        where: { series_id: seriesId },
      });
      await Promise.all([
        prepare(ward.id, kind),
        prepare(ward.id, kind),
        prepare(ward.id, kind),
      ]);
      assert.equal(
        await prisma.leadership_meeting.count({
          where: { series_id: seriesId },
        }),
        before,
      );
      assert.equal((await load(ward.id, kind, future.id)).items.length, 0);
      t.mock.timers.setTime(Date.parse("2026-03-01T12:00:00Z"));
      await Promise.all([prepare(ward.id, kind), prepare(ward.id, kind)]);
      assert.equal(
        await prisma.meeting_agenda_occurrence.count({
          where: { template_id: annualId, due_date: "2026-05-15" },
        }),
        1,
      );
      data = await load(ward.id, kind);
      assert.ok(
        data.meetings.some(
          (m) => m.date >= "2026-05-01" && m.date <= "2026-06-01",
        ),
      );
      assert.ok(
        data.meetings.every(
          (m) => m.date <= "2026-06-01" || m.id === future.id,
        ),
      );
      const count = data.meetings.length;
      await prepare(ward.id, kind);
      assert.equal((await load(ward.id, kind)).meetings.length, count);
      t.mock.timers.setTime(Date.parse("2026-01-31T12:00:00Z"));
    }
    t.mock.timers.setTime(Date.parse("2026-01-31T12:00:00Z"));
    const ward = await prisma.ward.create({
      data: { name: "Sparse", time_zone: "UTC" },
    });
    await execute(ward.id, {
      kind: "initialize",
      meetingKind: "bishopric",
      anchorDate: "2026-09-01",
      schedule: {
        version: 1,
        kind: "ordinal",
        interval: 24,
        ordinal: 1,
        weekday: 0,
      },
      startTime: "09:00",
      targetMinutes: 60,
    });
    let data = await load(ward.id, "bishopric");
    assert.equal(data.meeting, null);
    const seriesId = data.series.id;
    const source = await prisma.leadership_meeting.create({
      data: {
        series_id: seriesId,
        scheduled_date: "2025-12-07",
        date: "2025-12-07",
        start_time: "09:00",
        status: "active",
      },
    });
    await prisma.leadership_meeting.create({
      data: {
        series_id: seriesId,
        scheduled_date: "2026-09-06",
        date: "2026-09-06",
        start_time: "09:00",
        status: "cancelled",
      },
    });
    await execute(ward.id, {
      kind: "add",
      meetingId: source.id,
      requestId: randomUUID(),
      input: {
        title: "Carry one topic",
        durationMinutes: 5,
        anchorDate: source.date,
        recurrence: { version: 1, kind: "once" },
      },
    });
    data = await load(ward.id, "bishopric", source.id);
    await execute(ward.id, {
      kind: "outcome",
      itemId: data.items[0].id,
      outcome: "continued",
      decision: "Keep moving",
    });
    const planned = await prisma.leadership_meeting.findMany({
      where: { series_id: seriesId, status: "planned" },
    });
    assert.equal(planned.length, 1);
    assert.equal(planned[0].date, "2028-09-03");
    await Promise.all([
      prepare(ward.id, "bishopric"),
      prepare(ward.id, "bishopric"),
    ]);
    assert.equal(
      await prisma.leadership_meeting.count({ where: { series_id: seriesId } }),
      3,
    );
    const futureAgenda = await load(ward.id, "bishopric", planned[0].id);
    await execute(ward.id, {
      kind: "edit",
      itemId: futureAgenda.items[0].id,
      scope: "this",
      input: {
        title: "Edited",
        durationMinutes: 6,
        anchorDate: planned[0].date,
        recurrence: { version: 1, kind: "once" },
      },
    });
    await execute(ward.id, {
      kind: "reschedule",
      meetingId: planned[0].id,
      date: "2028-09-04",
      startTime: "10:00",
    });
    await execute(ward.id, {
      kind: "meeting",
      meetingId: planned[0].id,
      operation: "start",
    });
    await execute(ward.id, {
      kind: "meeting",
      meetingId: planned[0].id,
      operation: "close",
      unfinished: "skip",
    });
    assert.equal(
      await prisma.leadership_meeting.count({ where: { series_id: seriesId } }),
      3,
    );
    const historicWard = await prisma.ward.create({
      data: { name: "Past source", time_zone: "UTC" },
    });
    const historicSeries = await prisma.leadership_meeting_series.create({
      data: {
        ward_id: historicWard.id,
        kind: "bishopric",
        schedule: JSON.stringify({
          anchor: "2025-01-01",
          rule: { version: 1, kind: "weeks", interval: 1, weekday: 0 },
        }),
        start_time: "09:00",
        target_minutes: 60,
        time_zone: "UTC",
      },
    });
    const { nextMeeting } = await import("./store.ts");
    const next = await prisma.$transaction((db) =>
      nextMeeting(db, historicSeries.id, "2025-12-01"),
    );
    assert.equal(next.date, "2026-02-01");
    assert.equal(
      await prisma.leadership_meeting.count({
        where: { series_id: historicSeries.id },
      }),
      1,
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
