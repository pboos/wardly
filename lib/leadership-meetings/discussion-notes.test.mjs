import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { addDays, localToday } from "./calendar.ts";

const directory = mkdtempSync(join(tmpdir(), "wardly-discussion-notes-"));
const url = `file:${join(directory, "test.db")}`;
process.env.DATABASE_URL = url;
const migrations = new URL("../../prisma/migrations/", import.meta.url);
const sqlite = new Database(join(directory, "test.db"));
for (const name of readdirSync(migrations).filter((name) => /^\d/.test(name)).sort())
  sqlite.exec(readFileSync(new URL(`${name}/migration.sql`, migrations), "utf8"));
sqlite.close();
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }), log: [{ emit: "event", level: "query" }],
});
globalThis.prisma = prisma;
let queries = [];
prisma.$on("query", (event) => queries.push(event.query));
const { executeMeetingCommand: execute } = await import("./service.ts");
const { loadLeadershipMeeting: load } = await import("./loaders.ts");
const { loadPreviousMeetingNotes: history } = await import("./history.ts");
const today = localToday("UTC");
const every = { version: 1, kind: "every_meeting" };
async function fixture(name) {
  const ward = await prisma.ward.create({ data: { name, time_zone: "UTC" } });
  await execute(ward.id, {
    kind: "initialize", meetingKind: "bishopric", anchorDate: today,
    schedule: { version: 1, kind: "weeks", interval: 1, weekday: new Date(`${today}T12:00:00Z`).getUTCDay() },
    startTime: "09:00", targetMinutes: 60,
  });
  const data = await load(ward.id, "bishopric");
  const requestId = randomUUID();
  const command = { kind: "add", meetingId: data.meeting.id, requestId,
    input: { title: "Planning", durationMinutes: 5, anchorDate: today, recurrence: every } };
  await execute(ward.id, command);
  const current = await load(ward.id, "bishopric", data.meeting.id);
  const template = await prisma.meeting_agenda_template.findUniqueOrThrow({ where: { id: requestId } });
  return { ward, data: current, item: current.items[0], template, command };
}
const notes = (item, decision, sharedNotes) => ({
  kind: "notes", itemId: item.id, decision, expectedDecision: item.decision,
  ...(sharedNotes === undefined ? {} : { sharedNotes: { value: sharedNotes, expected: item.sharedNotes } }),
});

test("stable topic notes and bounded history", async (t) => {
  try {
    await t.test("future title and recurrence edits and carry retain the topic, prayers stay independent", async () => {
      const f = await fixture("Stable topics");
      await execute(f.ward.id, notes(f.item, "This week", "Remember this"));
      await execute(f.ward.id, f.command);
      assert.equal(await prisma.meeting_agenda_topic.count({ where: { series_id: f.data.series.id } }), 1);
      await execute(f.ward.id, { kind: "edit", itemId: f.item.id, scope: "future",
        input: { ...f.command.input, title: "Renamed planning", recurrence: { version: 1, kind: "weeks", interval: 2, weekday: new Date(`${today}T12:00:00Z`).getUTCDay() } } });
      const templates = await prisma.meeting_agenda_template.findMany({ where: { series_id: f.data.series.id } });
      assert.equal(templates.length, 2);
      assert.ok(templates.every((template) => template.topic_id === f.template.topic_id));
      let data = await load(f.ward.id, "bishopric", f.data.meeting.id);
      assert.equal(data.items[0].sharedNotes, "Remember this");
      await execute(f.ward.id, { kind: "outcome", itemId: f.item.id, outcome: "continued", decision: "This week", expectedDecision: "This week" });
      const successor = await prisma.meeting_agenda_item.findFirstOrThrow({ where: { predecessor_id: f.item.id } });
      data = await load(f.ward.id, "bishopric", successor.meeting_id);
      assert.equal(data.items.find((row) => row.id === successor.id).sharedNotes, "Remember this");
      await execute(f.ward.id, { kind: "add-all-suggestions", meetingId: successor.meeting_id, requestId: randomUUID() });
      const prayers = await prisma.meeting_agenda_template.findMany({ where: { series_id: f.data.series.id, title: "Prayer" } });
      assert.equal(prayers.length, 2);
      assert.equal(new Set(prayers.map((prayer) => prayer.topic_id)).size, 2);
      data = await load(f.ward.id, "bishopric", f.data.meeting.id);
      await prisma.meeting_agenda_template.updateMany({ where: { topic_id: f.template.topic_id }, data: { archived: true } });
      data = await load(f.ward.id, "bishopric", f.data.meeting.id);
      assert.equal(data.items.find((row) => row.id === f.item.id).hasSharedNotes, true);
      await execute(f.ward.id, notes(data.items.find((row) => row.id === f.item.id), "Historical amendment", "Archived shared context"));
      assert.equal((await load(f.ward.id, "bishopric", f.data.meeting.id)).items.find((row) => row.id === f.item.id).sharedNotes, "Archived shared context");
    });
    await t.test("notes, outcomes, conflicts, retries, clear and older callers are atomic", async () => {
      const f = await fixture("Atomic notes");
      await execute(f.ward.id, notes(f.item, "First", "Shared first"));
      await assert.rejects(execute(f.ward.id, { ...notes(f.item, "Stale meeting", "Shared second"), sharedNotes: { value: "Shared second", expected: "Shared first" } }), /Discussion notes changed/);
      let current = (await load(f.ward.id, "bishopric", f.data.meeting.id)).items[0];
      assert.equal(current.sharedNotes, "Shared first");
      assert.equal(current.decision, "First");
      await assert.rejects(execute(f.ward.id, { kind: "outcome", itemId: f.item.id, outcome: "continued", decision: "Would finish", expectedDecision: "First", sharedNotes: { value: "Stale shared", expected: "" } }), /Shared notes changed/);
      current = (await load(f.ward.id, "bishopric", f.data.meeting.id)).items[0];
      assert.equal(current.outcome, "pending");
      assert.equal(current.decision, "First");
      assert.equal(await prisma.meeting_agenda_item.count({ where: { predecessor_id: f.item.id } }), 0);
      const done = { kind: "outcome", itemId: current.id, outcome: "done", decision: "Final", expectedDecision: "First", sharedNotes: { value: "Shared final", expected: "Shared first" } };
      await execute(f.ward.id, done);
      await execute(f.ward.id, done);
      await assert.rejects(execute(f.ward.id, { ...done, sharedNotes: { value: "Stale shared", expected: "Shared first" } }), /Shared notes changed/);
      await execute(f.ward.id, { kind: "meeting", meetingId: f.data.meeting.id, operation: "close", unfinished: "skip" });
      current = (await load(f.ward.id, "bishopric", f.data.meeting.id)).items[0];
      await execute(f.ward.id, notes(current, "Amended history", ""));
      current = (await load(f.ward.id, "bishopric", f.data.meeting.id)).items[0];
      assert.equal(current.outcome, "done");
      assert.equal(current.sharedNotes, "");
      await execute(f.ward.id, notes(current, "Old caller"));
      assert.equal((await load(f.ward.id, "bishopric", f.data.meeting.id)).items[0].sharedNotes, "");
      await assert.rejects(execute(f.ward.id, { ...notes(current, "Too long"), sharedNotes: { value: "a".repeat(4001), expected: "" } }), /4000/);
      const foreign = await prisma.ward.create({ data: { name: "Other ward" } });
      await assert.rejects(execute(foreign.id, notes(current, "Forbidden", "Forbidden")), /not found/);
      await assert.rejects(history(foreign.id, { itemId: current.id, cursor: null }), /not found/);
    });
    await t.test("omitted shared notes preserve changes from another caller including quick Done", async () => {
      const f = await fixture("Omitted shared notes");
      await execute(f.ward.id, notes(f.item, "", "New context"));
      await execute(f.ward.id, { kind: "outcome", itemId: f.item.id, outcome: "done", decision: "", expectedDecision: "" });
      let current = (await load(f.ward.id, "bishopric", f.data.meeting.id)).items[0];
      assert.equal(current.sharedNotes, "New context");
      await execute(f.ward.id, notes(current, "Meeting only"));
      current = (await load(f.ward.id, "bishopric", f.data.meeting.id)).items[0];
      assert.equal(current.sharedNotes, "New context");
      assert.equal(current.decision, "Meeting only");
    });
    await t.test("history filters, deduplicates, paginates tied dates, and queries stay bounded", async () => {
      const f = await fixture("History");
      const historyIds = [];
      async function past(index, overrides = {}) {
        const date = addDays(today, -1 - Math.floor(index / 2));
        const meeting = await prisma.leadership_meeting.create({ data: { series_id: f.data.series.id, scheduled_date: `history:${index}`, date, start_time: "09:00", status: overrides.status ?? "closed" } });
        const item = await prisma.meeting_agenda_item.create({ data: { meeting_id: meeting.id, position: 0, title: `Past ${index}`, duration_minutes: 5, outcome: overrides.outcome ?? "done", decision: overrides.decision ?? `Notes ${index}` } });
        for (let link = 0; link < 2; link++)
          await prisma.meeting_agenda_occurrence.create({ data: { template_id: overrides.templateId ?? f.template.id, occurrence_key: `history:${index}:${link}`, due_date: date, appearances: { create: { item_id: item.id } } } });
        return item;
      }
      for (let index = 0; index < 25; index++) historyIds.push((await past(index)).id);
      await past(30, { decision: "" });
      await past(31, { outcome: "removed" });
      await past(32, { status: "superseded" });
      const otherTopic = await prisma.meeting_agenda_topic.create({ data: { series_id: f.data.series.id } });
      const unrelated = await prisma.meeting_agenda_template.create({ data: { topic_id: otherTopic.id, series_id: f.data.series.id, title: "Planning", duration_minutes: 5, anchor_date: today, recurrence: JSON.stringify(every) } });
      await past(33, { templateId: unrelated.id });
      const future = f.data.meetings.find((meeting) => meeting.date > today);
      await prisma.meeting_agenda_item.updateMany({ where: { meeting_id: future.id }, data: { decision: "Future excluded" } });
      await execute(f.ward.id, notes(f.item, "Current excluded", "Current shared"));
      queries = [];
      const first = await history(f.ward.id, { itemId: f.item.id, cursor: null });
      const count = queries.length;
      assert.equal(first.items.length, 20);
      assert.ok(first.nextCursor);
      assert.ok(count <= 8, `history used ${count} queries`);
      assert.equal(queries.filter((sql) => /^SELECT.*meeting_agenda_topic/i.test(sql)).length, 0);
      const second = await history(f.ward.id, { itemId: f.item.id, cursor: first.nextCursor });
      assert.equal(second.items.length, 5);
      assert.equal(second.nextCursor, null);
      const all = [...first.items, ...second.items];
      assert.equal(new Set(all.map((row) => row.id)).size, 25);
      assert.deepEqual(new Set(all.map((row) => row.id)), new Set(historyIds));
      assert.ok(all.every((row) => row.date < today && !Object.hasOwn(row, "sharedNotes")));
      const expected = [...all].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
      assert.deepEqual(all, expected);
      await assert.rejects(history(f.ward.id, { itemId: f.item.id, cursor: { date: "bad", id: "x" } }), /date/i);
      queries = [];
      await load(f.ward.id, "bishopric", f.data.meeting.id);
      assert.equal(queries.filter((sql) => /^SELECT .*FROM [`"]?main[`"]?\.[`"]?meeting_agenda_topic[`"]?/i.test(sql)).length, 1);
      t.diagnostic(`history ${count} queries; selected agenda shared notes use one topic SELECT`);
    });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
