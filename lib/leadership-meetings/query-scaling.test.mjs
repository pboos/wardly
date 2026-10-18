import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { addDays, localToday, scheduleThrough } from "./calendar.ts";

const directory = mkdtempSync(join(tmpdir(), "wardly-query-scaling-"));
const url = `file:${join(directory, "test.db")}`;
process.env.DATABASE_URL = url;
const sqlite = new Database(join(directory, "test.db"));
const migrations = new URL("../../prisma/migrations/", import.meta.url);
for (const name of readdirSync(migrations).filter((n) => /^\d/.test(n)).sort())
  sqlite.exec(readFileSync(new URL(`${name}/migration.sql`, migrations), "utf8"));
sqlite.close();
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
  log: [{ emit: "event", level: "query" }],
});
globalThis.prisma = prisma;
let queries = [];
prisma.$on("query", (event) => queries.push(event.query));
const { executeMeetingCommand: execute } = await import("./service.ts");
const { prepareLeadershipMeetings: prepare } = await import("./prepare.ts");
const { loadLeadershipMeeting: load } = await import("./loaders.ts");
const { ensureSchedule } = await import("./store.ts");
const today = localToday("UTC");

async function fixture(name, kind = "bishopric") {
  const ward = await prisma.ward.create({ data: { name, time_zone: "UTC" } });
  await execute(ward.id, {
    kind: "initialize", meetingKind: kind, anchorDate: today,
    schedule: { version: 1, kind: "weeks", interval: 1, weekday: new Date(`${today}T12:00:00Z`).getUTCDay() },
    startTime: "09:00", targetMinutes: 60,
  });
  return { ward, data: await load(ward.id, kind) };
}

test("bulk preparation and suggested agenda persistence", async (t) => {
  try {
    await t.test("warm page preparation stays bounded as recurring topics grow", async () => {
      const counts = [];
      for (const count of [1, 20]) {
        const { ward, data } = await fixture(`Topics ${count}`);
        for (let index = 0; index < count; index++)
          await execute(ward.id, {
            kind: "add", meetingId: data.meeting.id, requestId: randomUUID(),
            input: { title: `Topic ${index}`, durationMinutes: 2, anchorDate: today, recurrence: { version: 1, kind: "every_meeting" } },
          });
        const original = await load(ward.id, "bishopric", data.meeting.id);
        for (let repeat = 0; repeat < 3; repeat++) {
          queries = [];
          await prepare(ward.id, "bishopric");
          const loaded = await load(ward.id, "bishopric", data.meeting.id);
          counts.push(queries.length);
          assert.deepEqual(loaded, original);
          assert.equal(loaded.items.length, count);
          assert.equal(queries.filter((sql) => /^(INSERT|UPDATE|DELETE)\b/i.test(sql)).length, 0);
          assert.ok(queries.length <= 40, `prepare + load used ${queries.length} queries`);
        }
      }
      assert.equal(new Set(counts).size, 1);
      t.diagnostic(`warm prepare + load queries: ${counts.join(", ")}`);
    });

    await t.test("bulk schedule lookup preserves exceptions and custom date collisions", async () => {
      const { data } = await fixture("Schedule exceptions");
      const rows = await prisma.leadership_meeting.findMany({ where: { series_id: data.series.id }, orderBy: { date: "asc" } });
      const [blocked, cancelled, moved, revived] = rows;
      await prisma.leadership_meeting.updateMany({ where: { id: { in: [blocked.id, revived.id] } }, data: { status: "superseded" } });
      await prisma.leadership_meeting.update({ where: { id: cancelled.id }, data: { status: "cancelled" } });
      await prisma.leadership_meeting.update({ where: { id: moved.id }, data: { date: addDays(moved.date, 1) } });
      await prisma.leadership_meeting.create({ data: { series_id: data.series.id, scheduled_date: addDays(blocked.date, 1), date: blocked.date, start_time: "10:00" } });
      await ensureSchedule(prisma, data.series.id, scheduleThrough(today));
      const saved = await prisma.leadership_meeting.findMany({ where: { series_id: data.series.id } });
      assert.equal(saved.length, rows.length + 1);
      assert.equal(saved.find((row) => row.id === blocked.id).status, "superseded");
      assert.equal(saved.find((row) => row.id === cancelled.id).status, "cancelled");
      assert.equal(saved.find((row) => row.id === moved.id).date, addDays(moved.date, 1));
      assert.equal(saved.find((row) => row.id === revived.id).status, "planned");
    });

    await t.test("Add entire agenda batches new selected rows and retains receipt idempotency", async () => {
      for (const kind of ["bishopric", "ward_council"]) {
      const { ward, data } = await fixture(`Bulk suggestions ${kind}`, kind);
      const command = { kind: "add-all-suggestions", meetingId: data.meeting.id, requestId: randomUUID() };
      queries = [];
      await execute(ward.id, command);
      assert.ok(queries.length <= 60, `Add entire agenda used ${queries.length} queries`);
      assert.ok(queries.filter((sql) => /^INSERT\b/i.test(sql)).length <= 8);
      const templateInserts = queries.filter((sql) => /^INSERT INTO [`"]?(?:main[`"]?\.)?[`"]?meeting_agenda_template[`"]?/i.test(sql));
      assert.equal(templateInserts.length, 1);
      const topicInserts = queries.filter((sql) => /^INSERT INTO [`"]?(?:main[`"]?\.)?[`"]?meeting_agenda_topic[`"]?/i.test(sql));
      assert.equal(topicInserts.length, 1);
      t.diagnostic(`Add entire ${kind} agenda: ${queries.length} queries, ${queries.filter((sql) => /^INSERT\b/i.test(sql)).length} INSERT statements including one topic batch`);
      const loaded = await load(ward.id, kind, data.meeting.id);
      assert.equal(loaded.items[0].title, "Prayer");
      assert.equal(loaded.items.at(-1).title, "Prayer");
      assert.equal(loaded.items.filter((item) => item.title === "Prayer").length, 2);
      assert.ok(loaded.items.every((item) => item.instructions.length > 0));
      await execute(ward.id, command);
      assert.deepEqual(await load(ward.id, kind, data.meeting.id), loaded);
      }
    });
    await t.test("fresh defaults seed active, held, and past selected meetings", async () => {
      for (const mode of ["active", "held", "past"]) {
        const { ward, data } = await fixture(`Selected ${mode}`);
        if (mode === "active")
          await prisma.leadership_meeting.update({ where: { id: data.meeting.id }, data: { status: "active" } });
        if (mode === "past")
          await prisma.leadership_meeting.update({ where: { id: data.meeting.id }, data: { date: addDays(today, -1) } });
        if (mode === "held")
          await prisma.meeting_agenda_item.create({ data: { meeting_id: data.meeting.id, title: "Existing notes", decision: "Keep these notes", duration_minutes: 3, position: 0 } });
        await execute(ward.id, { kind: "add-all-suggestions", meetingId: data.meeting.id, requestId: randomUUID() });
        const loaded = await load(ward.id, "bishopric", data.meeting.id);
        assert.equal(loaded.items.filter((item) => item.title === "Prayer").length, 2);
        assert.ok(loaded.items.some((item) => item.title === "Spiritual thought"));
        if (mode === "held")
          assert.equal(loaded.items.find((item) => item.title === "Existing notes").decision, "Keep these notes");
      }
    });

    await t.test("fresh calendar dues coalesce while existing held content stays intact", async () => {
      const { ward, data } = await fixture("Coalesced fresh calendar dues");
      const custom = await prisma.meeting_agenda_item.create({ data: { meeting_id: data.meeting.id, title: "Customized discussion", instructions: "Local instructions", decision: "Saved decision", duration_minutes: 17, position: 0 } });
      await prisma.leadership_meeting.updateMany({ where: { series_id: data.series.id, id: { notIn: data.meetings.slice(0, 2).map((row) => row.id) } }, data: { status: "cancelled" } });
      const { createSuggestedAgenda } = await import("./suggestion-batch.ts");
      const { suggestionsForKind } = await import("./suggestions.ts");
      const selected = await prisma.leadership_meeting.findUniqueOrThrow({ where: { id: data.meeting.id }, include: { series: true } });
      await createSuggestedAgenda(prisma, selected, [{
        ...suggestionsForKind("bishopric")[0],
        recurrence: { version: 1, kind: "weeks", interval: 1, weekday: new Date(`${today}T12:00:00Z`).getUTCDay() },
      }]);
      const templates = await prisma.meeting_agenda_template.findMany({ where: { series_id: data.series.id } });
      assert.equal(templates.length, 1);
      const occurrences = await prisma.meeting_agenda_occurrence.findMany({ where: { template_id: templates[0].id }, include: { appearances: true } });
      assert.ok(occurrences.length >= 10);
      assert.equal(new Set(occurrences.flatMap((row) => row.appearances.map((link) => link.item_id))).size, 1);
      assert.ok(occurrences.every((row) => row.appearances.length === 1));
      assert.deepEqual(await prisma.meeting_agenda_item.findUnique({ where: { id: custom.id } }), custom);
      await prepare(ward.id, "bishopric");
      assert.deepEqual(await prisma.meeting_agenda_item.findUnique({ where: { id: custom.id } }), custom);
    });

  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
