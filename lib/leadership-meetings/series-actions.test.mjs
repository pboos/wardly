import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { addDays, localToday } from "./calendar.ts";
const directory = mkdtempSync(join(tmpdir(), "wardly-leadership-test-"));
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
const { loadLeadershipMeeting: load } = await import("./loaders.ts");
const today = localToday("UTC");
const sunday = addDays(
  today,
  (7 - new Date(`${today}T12:00:00Z`).getUTCDay()) % 7,
);
const schedule = { version: 1, kind: "weeks", interval: 1, weekday: 0 };
async function fixture(name) {
  const ward = await prisma.ward.create({ data: { name } });
  await execute(ward.id, {
    kind: "initialize",
    meetingKind: "bishopric",
    anchorDate: today,
    schedule,
    startTime: "09:00",
    targetMinutes: 60,
  });
  return { ward, data: await load(ward.id, "bishopric") };
}
async function add(
  wardId,
  meetingId,
  title,
  recurrence = { version: 1, kind: "once" },
  anchorDate = sunday,
) {
  const requestId = randomUUID();
  const command = {
    kind: "add",
    meetingId,
    requestId,
    input: { title, durationMinutes: 5, recurrence, anchorDate },
  };
  await execute(wardId, command);
  return command;
}
test("recurring defaults and scoped removal", async (t) => {
  try {
    await t.test(
      "recurring defaults preserve absent slots and meeting snapshots",
      async () => {
        const { ward, data } = await fixture("Defaults");
        const recurring = { version: 1, kind: "every_meeting" };
        const a = await add(ward.id, data.meeting.id, "A", recurring);
        const monthly = await add(
          ward.id,
          data.meeting.id,
          "Monthly",
          { version: 1, kind: "months", interval: 1, day: 1 },
          addDays(sunday, 35),
        );
        const b = await add(ward.id, data.meeting.id, "B", recurring);
        await add(ward.id, data.meeting.id, "One time");
        const current = await load(ward.id, "bishopric", data.meeting.id);
        const ids = [...current.items].reverse().map((row) => row.id);
        const next = data.meetings.find((m) => m.date > data.meeting.date);
        const originalFuture = await load(ward.id, "bishopric", next.id);
        await execute(ward.id, {
          kind: "reorder",
          meetingId: data.meeting.id,
          itemIds: ids,
        });
        assert.deepEqual(
          (await load(ward.id, "bishopric", next.id)).items.map((r) => r.id),
          originalFuture.items.map((r) => r.id),
        );
        const foreign = await prisma.ward.create({
          data: { name: "Foreign defaults" },
        });
        await assert.rejects(
          execute(foreign.id, {
            kind: "save-future-order",
            meetingId: data.meeting.id,
            itemIds: ids,
          }),
        );
        await assert.rejects(
          execute(ward.id, {
            kind: "save-future-order",
            meetingId: data.meeting.id,
            itemIds: ids.slice(1),
          }),
        );
        await execute(ward.id, {
          kind: "save-future-order",
          meetingId: data.meeting.id,
          itemIds: ids,
        });
        const templates = await prisma.meeting_agenda_template.findMany({
          where: { series_id: data.series.id, archived: false },
          orderBy: { position: "asc" },
        });
        assert.deepEqual(
          templates
            .filter((r) =>
              [a.requestId, monthly.requestId, b.requestId].includes(r.id),
            )
            .map((r) => r.title),
          ["B", "Monthly", "A"],
        );
        assert.deepEqual(
          (await load(ward.id, "bishopric", next.id)).items.map((r) => r.title),
          ["B", "A"],
        );
        const source = await load(ward.id, "bishopric", data.meeting.id);
        assert.deepEqual(
          source.items.map((r) => r.id),
          ids,
        );
        const itemB = source.items.find((r) => r.title === "B");
        await execute(ward.id, {
          kind: "edit",
          itemId: itemB.id,
          scope: "future",
          input: { ...b.input, title: "B revised" },
        });
        const replacement = await prisma.meeting_agenda_template.findFirst({
          where: { series_id: data.series.id, title: "B revised" },
        });
        assert.equal(
          replacement.position,
          templates.find((r) => r.id === b.requestId).position,
        );
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: sunday,
        });
        assert.deepEqual(
          (await load(ward.id, "bishopric", next.id)).items.map((r) => r.title),
          ["B revised", "A"],
        );
        const horizon = data.meetings.at(-1).date;
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: addDays(horizon, 60),
        });
        const extended = await prisma.leadership_meeting.findFirst({
          where: { series_id: data.series.id, date: { gt: horizon } },
          orderBy: { date: "asc" },
        });
        const fresh = await load(ward.id, "bishopric", extended.id);
        assert.deepEqual(
          fresh.items.filter((r) => r.title !== "Monthly").map((r) => r.title),
          ["B revised", "A"],
        );
      },
    );
    await t.test(
      "scoped removal preserves carried history, notes, tasks and prevents regeneration",
      async () => {
        const { ward, data } = await fixture("Removal scopes");
        const command = await add(
          ward.id,
          data.meeting.id,
          "Calendar",
          {
            version: 1,
            kind: "months",
            interval: 1,
            day: new Date(sunday + "T12:00:00Z").getUTCDate(),
          },
          sunday,
        );
        let current = await load(ward.id, "bishopric", data.meeting.id);
        const source = current.items[0];
        const taskId = randomUUID();
        await execute(ward.id, {
          kind: "task",
          itemId: source.id,
          title: "Keep task",
          assignedUserId: null,
          requestId: taskId,
        });
        await execute(ward.id, {
          kind: "outcome",
          itemId: source.id,
          outcome: "continued",
          decision: "Keep history",
        });
        const next = data.meetings.find((m) => m.date > data.meeting.date);
        current = await load(ward.id, "bishopric", next.id);
        const carried = current.items.find(
          (r) => r.predecessorId === source.id,
        );
        const occurrence =
          await prisma.meeting_agenda_item_occurrence.findFirst({
            where: { item_id: carried.id },
          });
        await execute(ward.id, {
          kind: "remove",
          itemId: carried.id,
          scope: "this",
        });
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: sunday,
        });
        assert.equal(
          (await load(ward.id, "bishopric", next.id)).items.some(
            (r) => r.id === carried.id || r.title === "Calendar",
          ),
          false,
        );
        assert.equal(
          (
            await prisma.meeting_agenda_occurrence.findUnique({
              where: { id: occurrence.occurrence_id },
            })
          ).status,
          "pending",
        );
        assert.equal(
          (
            await prisma.meeting_agenda_template.findUnique({
              where: { id: command.requestId },
            })
          ).archived,
          false,
        );
        const foreign = await prisma.ward.create({
          data: { name: "Foreign removal" },
        });
        await assert.rejects(
          execute(foreign.id, {
            kind: "remove",
            itemId: carried.id,
            scope: "future",
          }),
        );
        await execute(ward.id, {
          kind: "remove",
          itemId: carried.id,
          scope: "future",
        });
        await execute(ward.id, {
          kind: "remove",
          itemId: carried.id,
          scope: "future",
        });
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: sunday,
        });
        const history = await prisma.meeting_agenda_item.findUnique({
          where: { id: source.id },
          include: { tasks: true },
        });
        assert.equal(history.outcome, "continued");
        assert.equal(history.decision, "Keep history");
        assert.equal(history.tasks[0].task_id, taskId);
        assert.equal(
          await prisma.meeting_agenda_item_task.count({
            where: { item_id: carried.id, task_id: taskId },
          }),
          1,
        );
        assert.equal(
          await prisma.meeting_agenda_item.count({
            where: {
              outcome: "pending",
              occurrences: {
                some: { occurrence: { template_id: command.requestId } },
              },
            },
          }),
          0,
        );
        assert.equal(
          (
            await prisma.meeting_agenda_template.findUnique({
              where: { id: command.requestId },
            })
          ).archived,
          true,
        );
      },
    );
    await t.test(
      "future apply preserves fixed slots and existing local orders survive reconciliation",
      async () => {
        const { ward, data } = await fixture("Slots");
        const rule = { version: 1, kind: "every_meeting" };
        await add(ward.id, data.meeting.id, "A", rule);
        await add(ward.id, data.meeting.id, "B", rule);
        await add(ward.id, data.meeting.id, "C", rule);
        const next = data.meetings.find((m) => m.date > data.meeting.date);
        await add(
          ward.id,
          next.id,
          "Fixed",
          { version: 1, kind: "once" },
          next.date,
        );
        let future = await load(ward.id, "bishopric", next.id);
        const find = (title) => future.items.find((r) => r.title === title).id;
        await execute(ward.id, {
          kind: "reorder",
          meetingId: next.id,
          itemIds: [find("C"), find("Fixed"), find("A"), find("B")],
        });
        await execute(ward.id, {
          kind: "outcome",
          itemId: find("A"),
          outcome: "done",
          decision: "Resolved",
        });
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: sunday,
        });
        future = await load(ward.id, "bishopric", next.id);
        assert.deepEqual(
          future.items.map((r) => r.title),
          ["C", "Fixed", "A", "B"],
        );
        const current = await load(ward.id, "bishopric", data.meeting.id);
        await execute(ward.id, {
          kind: "save-future-order",
          meetingId: data.meeting.id,
          itemIds: current.items.map((r) => r.id),
        });
        assert.deepEqual(
          (await load(ward.id, "bishopric", next.id)).items.map((r) => r.title),
          ["B", "Fixed", "A", "C"],
        );
        await execute(ward.id, {
          kind: "outcome",
          itemId: current.items.find((r) => r.title === "B").id,
          outcome: "continued",
          decision: "Carry",
        });
        future = await load(ward.id, "bishopric", next.id);
        assert.deepEqual(
          future.items.filter((r) => r.title !== "B").map((r) => r.title),
          ["Fixed", "A", "C"],
        );
        assert.equal(future.items.filter((r) => r.title === "B").length, 1);
        await execute(ward.id, {
          kind: "meeting",
          meetingId: next.id,
          operation: "start",
        });
        await execute(ward.id, {
          kind: "remove",
          itemId: current.items.find((r) => r.title === "B").id,
          scope: "future",
        }).then(
          () => assert.fail("Resolved source must reject removal"),
          () => {},
        );
        const carried = future.items.find((r) => r.title === "B");
        await execute(ward.id, {
          kind: "remove",
          itemId: carried.id,
          scope: "future",
        });
        assert.equal(
          (await load(ward.id, "bishopric", next.id)).items.some(
            (r) => r.title === "B",
          ),
          false,
        );
      },
    );
    await t.test(
      "carried discussion inherits its existing destination slot",
      async () => {
        const { ward, data } = await fixture("Carry order");
        const recurring = { version: 1, kind: "every_meeting" };
        for (const title of ["A", "B", "C"])
          await add(ward.id, data.meeting.id, title, recurring);
        const next = data.meetings.find((m) => m.date > data.meeting.date);
        const future = await load(ward.id, "bishopric", next.id);
        await execute(ward.id, {
          kind: "reorder",
          meetingId: next.id,
          itemIds: ["C", "A", "B"].map(
            (title) => future.items.find((r) => r.title === title).id,
          ),
        });
        const source = await load(ward.id, "bishopric", data.meeting.id);
        await execute(ward.id, {
          kind: "outcome",
          itemId: source.items.find((r) => r.title === "B").id,
          outcome: "continued",
          decision: "Carry",
        });
        assert.deepEqual(
          (await load(ward.id, "bishopric", next.id)).items.map((r) => r.title),
          ["C", "A", "B"],
        );
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: sunday,
        });
        assert.deepEqual(
          (await load(ward.id, "bishopric", next.id)).items.map((r) => r.title),
          ["C", "A", "B"],
        );
      },
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
