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
test("leadership persistence, transitions, schedule changes and ward isolation", async (t) => {
  try {
    await t.test(
      "idempotent additions, task links, outcomes and recurrence coalesce",
      async () => {
        const { ward, data } = await fixture("Bishopric");
        const foreign = await prisma.ward.create({
          data: { name: "Other ward" },
        });
        const command = await add(ward.id, data.meeting.id, "Assignments", {
          version: 1,
          kind: "every_meeting",
        });
        await execute(ward.id, command);
        let current = await load(ward.id, "bishopric", data.meeting.id);
        assert.equal(current.items.length, 1);
        const item = current.items[0];
        await assert.rejects(
          execute(foreign.id, {
            kind: "outcome",
            itemId: item.id,
            outcome: "done",
            decision: "",
          }),
        );
        const taskId = randomUUID();
        await execute(ward.id, {
          kind: "task",
          itemId: item.id,
          title: "Call the organizer",
          assignedUserId: null,
          requestId: taskId,
        });
        await execute(ward.id, {
          kind: "task",
          itemId: item.id,
          title: "Call the organizer",
          assignedUserId: null,
          requestId: taskId,
        });
        assert.equal(await prisma.task.count({ where: { id: taskId } }), 1);
        const outcome = {
          kind: "outcome",
          itemId: item.id,
          outcome: "continued",
          decision: "Ask for updated attendance.",
        };
        await execute(ward.id, outcome);
        await execute(ward.id, outcome);
        assert.equal(
          await prisma.meeting_agenda_item.count({
            where: { predecessor_id: item.id },
          }),
          1,
        );
        const next = data.meetings.find((m) => m.date > data.meeting.date);
        current = await load(ward.id, "bishopric", next.id);
        assert.equal(
          current.items.filter((i) => i.title === "Assignments").length,
          1,
        );
        assert.equal(current.items[0].dueDates.length, 2);
        assert.equal(current.items[0].tasks.length, 1);
        await execute(ward.id, {
          kind: "outcome",
          itemId: current.items[0].id,
          outcome: "done",
          decision: "Agreed.",
        });
        assert.equal(
          (await prisma.task.findUnique({ where: { id: taskId } }))
            .completed_at,
          null,
        );
        await execute(ward.id, {
          kind: "meeting",
          meetingId: next.id,
          operation: "close",
          unfinished: "skip",
        });
        await assert.rejects(
          execute(ward.id, {
            kind: "edit",
            itemId: current.items[0].id,
            input: command.input,
            scope: "this",
          }),
        );
        assert.equal(
          (await load(ward.id, "bishopric", data.meeting.id)).items[0].decision,
          outcome.decision,
        );
      },
    );
    await t.test(
      "first monthly due is placed before its anchor and completion does not shift cadence",
      async () => {
        const { ward, data } = await fixture("Calendar");
        const due = addDays(sunday, 3);
        const command = await add(
          ward.id,
          data.meeting.id,
          "Monthly review",
          {
            version: 1,
            kind: "months",
            interval: 1,
            day: Number(due.slice(-2)),
          },
          due,
        );
        const current = await load(ward.id, "bishopric", data.meeting.id);
        assert.equal(current.items.length, 1);
        assert.deepEqual(current.items[0].dueDates, [due]);
        await execute(ward.id, {
          kind: "outcome",
          itemId: current.items[0].id,
          outcome: "done",
          decision: "",
        });
        const later = await prisma.meeting_agenda_occurrence.findMany({
          where: { template_id: command.requestId, due_date: { gt: due } },
        });
        assert.ok(later.length >= 11);
        assert.ok(later.every((o) => o.status === "pending"));
      },
    );
    await t.test(
      "schedule changes preserve edited and ad-hoc agendas and cancelled exceptions",
      async () => {
        const { ward, data } = await fixture("Schedules");
        await add(ward.id, data.meeting.id, "Custom one-time discussion");
        const original = (await load(ward.id, "bishopric", data.meeting.id))
          .items[0];
        await execute(ward.id, {
          kind: "task",
          itemId: original.id,
          title: "Keep this link",
          assignedUserId: null,
          requestId: randomUUID(),
        });
        const base = {
          kind: "schedule",
          seriesId: data.series.id,
          anchorDate: today,
          schedule,
          startTime: "10:30",
          targetMinutes: 45,
        };
        await execute(ward.id, base);
        let current = await load(ward.id, "bishopric", data.meeting.id);
        assert.equal(current.meeting.status, "planned");
        assert.equal(current.meeting.start_time, "10:30");
        assert.equal(current.items[0].id, original.id);
        const cancel = current.meetings.find((m) => m.date > sunday);
        await execute(ward.id, {
          kind: "meeting",
          meetingId: cancel.id,
          operation: "cancel",
          unfinished: "skip",
        });
        await execute(ward.id, base);
        assert.equal(
          (
            await prisma.leadership_meeting.findUnique({
              where: { id: cancel.id },
            })
          ).status,
          "cancelled",
        );
        await execute(ward.id, {
          ...base,
          schedule: { ...schedule, weekday: 1 },
        });
        const item = await prisma.meeting_agenda_item.findUnique({
          where: { id: original.id },
          include: { meeting: true, tasks: true },
        });
        assert.equal(item.meeting.status, "planned");
        assert.equal(item.tasks.length, 1);
        assert.equal(item.title, original.title);
        assert.equal(new Date(`${item.meeting.date}T12:00:00Z`).getUTCDay(), 1);
      },
    );
    await t.test(
      "remove tombstones, import UUIDs, future edits and active agenda freeze",
      async () => {
        const { ward, data } = await fixture("History");
        const command = await add(ward.id, data.meeting.id, "Standing", {
          version: 1,
          kind: "every_meeting",
        });
        let current = await load(ward.id, "bishopric", data.meeting.id);
        await execute(ward.id, { kind: "remove", itemId: current.items[0].id });
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: sunday,
        });
        assert.equal(
          (await load(ward.id, "bishopric", data.meeting.id)).items.length,
          0,
        );
        const imported = {
          kind: "import",
          meetingId: data.meeting.id,
          items: [{ id: "old-1", name: "Legacy", durationMin: 4 }],
        };
        await execute(ward.id, imported);
        await execute(ward.id, imported);
        current = await load(ward.id, "bishopric", data.meeting.id);
        assert.equal(current.items.length, 1);
        const item = current.items[0];
        await execute(ward.id, {
          kind: "edit",
          itemId: item.id,
          input: { ...command.input, title: "Changed" },
          scope: "future",
        });
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: sunday,
        });
        assert.equal(
          (await load(ward.id, "bishopric", data.meeting.id)).items.filter(
            (i) => i.title === "Changed",
          ).length,
          1,
        );
        await execute(ward.id, {
          kind: "meeting",
          meetingId: data.meeting.id,
          operation: "start",
        });
        await assert.rejects(
          execute(ward.id, {
            kind: "reschedule",
            meetingId: data.meeting.id,
            date: addDays(sunday, 1),
            startTime: "10:00",
          }),
        );
        await execute(ward.id, {
          kind: "meeting",
          meetingId: data.meeting.id,
          operation: "close",
          unfinished: "defer",
        });
        assert.equal(
          (await load(ward.id, "bishopric", data.meeting.id)).items[0].outcome,
          "deferred",
        );
      },
    );
    await t.test(
      "weekday changes retire pristine standing items without duplicates or horizon failure",
      async () => {
        const { ward, data } = await fixture("Standing schedule change");
        await add(ward.id, data.meeting.id, "Standing", {
          version: 1,
          kind: "every_meeting",
        });
        for (const anchorDate of [today, addDays(today, 7)]) {
          await execute(ward.id, {
            kind: "schedule",
            seriesId: data.series.id,
            anchorDate,
            schedule: { ...schedule, weekday: 1 },
            startTime: "09:00",
            targetMinutes: 60,
          });
          const current = await load(ward.id, "bishopric");
          assert.equal(current.items.length, 1);
        }
      },
    );
    await t.test(
      "changing fortnightly meetings to weekly splits coalesced obligations by due date",
      async () => {
        const { ward, data } = await fixture("Split obligations");
        const base = {
          kind: "schedule",
          seriesId: data.series.id,
          anchorDate: today,
          startTime: "09:00",
          targetMinutes: 60,
        };
        await execute(ward.id, {
          ...base,
          schedule: { ...schedule, interval: 2 },
        });
        let current = await load(ward.id, "bishopric");
        await add(ward.id, current.meeting.id, "Weekly due", schedule);
        await execute(ward.id, { ...base, schedule });
        current = await load(ward.id, "bishopric");
        assert.deepEqual(current.items[0].dueDates, [sunday]);
        const next = current.meetings.find(
          (m) => m.date === addDays(sunday, 7),
        );
        assert.deepEqual(
          (await load(ward.id, "bishopric", next.id)).items[0].dueDates,
          [addDays(sunday, 7)],
        );
      },
    );
    await t.test(
      "future calendar edits preserve anchor without duplicate current or shifted cadence",
      async () => {
        const { ward, data } = await fixture("Calendar edits");
        const due = addDays(sunday, 3);
        const command = await add(
          ward.id,
          data.meeting.id,
          "Quarterly review",
          {
            version: 1,
            kind: "months",
            interval: 3,
            day: Number(due.slice(-2)),
          },
          due,
        );
        let current = await load(ward.id, "bishopric");
        await execute(ward.id, {
          kind: "edit",
          itemId: current.items[0].id,
          input: { ...command.input, title: "Updated quarterly review" },
          scope: "future",
        });
        await execute(ward.id, {
          kind: "prepare",
          seriesId: data.series.id,
          date: sunday,
        });
        current = await load(ward.id, "bishopric");
        assert.equal(current.items.length, 1);
        assert.equal(current.items[0].repeating, true);
        const replacement = await prisma.meeting_agenda_template.findFirst({
          where: { series_id: data.series.id, archived: false },
        });
        assert.equal(replacement.anchor_date, due);
        const dues = await prisma.meeting_agenda_occurrence.findMany({
          where: { template_id: replacement.id },
          orderBy: { due_date: "asc" },
        });
        assert.equal(dues.filter((o) => o.due_date === due).length, 1);
        assert.ok(dues[1].due_date > addDays(due, 60));
        await execute(ward.id, {
          kind: "outcome",
          itemId: current.items[0].id,
          outcome: "done",
          decision: "Preserve this decision",
        });
        await execute(ward.id, {
          kind: "schedule",
          seriesId: data.series.id,
          anchorDate: today,
          schedule: { ...schedule, weekday: 1 },
          startTime: "09:00",
          targetMinutes: 60,
        });
        assert.equal(
          (await load(ward.id, "bishopric", data.meeting.id)).items[0].decision,
          "Preserve this decision",
        );
      },
    );
    await t.test(
      "restored schedule revives only retired generation, not user skip/remove",
      async () => {
        const { ward, data } = await fixture("Restore standing schedule");
        for (const title of ["Standing", "Skipped by user", "Removed by user"])
          await add(ward.id, data.meeting.id, title, {
            version: 1,
            kind: "every_meeting",
          });
        const before = await load(ward.id, "bishopric");
        const second = before.meetings.find((m) => m.date > sunday);
        const later = await load(ward.id, "bishopric", second.id);
        await execute(ward.id, {
          kind: "outcome",
          itemId: later.items.find((i) => i.title === "Skipped by user").id,
          outcome: "skipped",
          decision: "",
        });
        await execute(ward.id, {
          kind: "remove",
          itemId: before.items.find((i) => i.title === "Removed by user").id,
        });
        const base = {
          kind: "schedule",
          seriesId: data.series.id,
          anchorDate: today,
          startTime: "09:00",
          targetMinutes: 60,
        };
        await execute(ward.id, {
          ...base,
          schedule: { ...schedule, weekday: 1 },
        });
        await execute(ward.id, { ...base, schedule });
        const restored = await load(ward.id, "bishopric", data.meeting.id);
        assert.equal(restored.meeting.id, data.meeting.id);
        assert.equal(
          restored.items.filter((i) => i.title === "Standing").length,
          1,
        );
        assert.equal(
          restored.items.some((i) => i.title === "Removed by user"),
          false,
        );
        const skipped = (
          await load(ward.id, "bishopric", second.id)
        ).items.filter((i) => i.title === "Skipped by user");
        assert.equal(skipped.length, 1);
        assert.equal(skipped[0].outcome, "skipped");
      },
    );
    await t.test(
      "customized and carried standing discussions absorb destination generation",
      async () => {
        for (const carry of [false, true]) {
          const { ward, data } = await fixture(`Meaningful standing ${carry}`);
          const command = await add(ward.id, data.meeting.id, "Standing", {
            version: 1,
            kind: "every_meeting",
          });
          let row = (await load(ward.id, "bishopric")).items[0];
          await execute(ward.id, {
            kind: "edit",
            itemId: row.id,
            scope: "this",
            input: {
              ...command.input,
              title: "Customized discussion",
              durationMinutes: 12,
            },
          });
          const taskId = randomUUID();
          await execute(ward.id, {
            kind: "task",
            itemId: row.id,
            title: "Keep this assignment",
            assignedUserId: null,
            requestId: taskId,
          });
          let selectedDate = sunday;
          if (carry) {
            await execute(ward.id, {
              kind: "outcome",
              itemId: row.id,
              outcome: "continued",
              decision: "Return with more information",
            });
            selectedDate = addDays(sunday, 7);
            const next = data.meetings.find((m) => m.date === selectedDate);
            row = (await load(ward.id, "bishopric", next.id)).items[0];
          }
          await execute(ward.id, {
            kind: "schedule",
            seriesId: data.series.id,
            anchorDate: today,
            schedule: { ...schedule, weekday: 1 },
            startTime: "09:00",
            targetMinutes: 60,
          });
          const moved = await prisma.meeting_agenda_item.findUnique({
            where: { id: row.id },
            include: { meeting: true },
          });
          const destination = await load(
            ward.id,
            "bishopric",
            moved.meeting.id,
          );
          const related = destination.items.filter(
            (i) =>
              i.title === "Standing" || i.title === "Customized discussion",
          );
          assert.equal(related.length, 1);
          assert.equal(related[0].title, "Customized discussion");
          assert.equal(related[0].durationMinutes, 12);
          assert.deepEqual(
            related[0].tasks.map((t) => t.id),
            [taskId],
          );
          assert.ok(related[0].dueDates.includes(selectedDate));
          assert.ok(related[0].dueDates.includes(addDays(selectedDate, 1)));
          if (carry) assert.ok(related[0].predecessorId);
        }
      },
    );
    await t.test(
      "time-only schedule update accepts an existing past anchor without cadence drift or historical backfill",
      async () => {
        const { ward, data } = await fixture("Preserve phase");
        const fortnight = { ...schedule, interval: 2 };
        await execute(ward.id, {
          kind: "schedule",
          seriesId: data.series.id,
          anchorDate: today,
          schedule: fortnight,
          startTime: "09:00",
          targetMinutes: 60,
        });
        const pastAnchor = addDays(today, -14);
        await prisma.leadership_meeting_series.update({
          where: { id: data.series.id },
          data: {
            schedule: JSON.stringify({ anchor: pastAnchor, rule: fortnight }),
          },
        });
        const before = await prisma.leadership_meeting.findMany({
          where: { series_id: data.series.id, status: "planned" },
          orderBy: { date: "asc" },
        });
        await execute(ward.id, {
          kind: "schedule",
          seriesId: data.series.id,
          anchorDate: pastAnchor,
          schedule: fortnight,
          startTime: "11:00",
          targetMinutes: 60,
        });
        const after = await prisma.leadership_meeting.findMany({
          where: { series_id: data.series.id, status: "planned" },
          orderBy: { date: "asc" },
        });
        assert.deepEqual(
          after.map((m) => [m.id, m.date]),
          before.map((m) => [m.id, m.date]),
        );
        assert.ok(
          after.every((m) => m.start_time === "11:00" && m.date >= today),
        );
        assert.equal(
          JSON.parse(
            (
              await prisma.leadership_meeting_series.findUnique({
                where: { id: data.series.id },
              })
            ).schedule,
          ).anchor,
          pastAnchor,
        );
      },
    );
    await t.test(
      "removed recurring suggestions restore their edits and coalesce at the next meeting",
      async () => {
        for (const recurrence of [
          { version: 1, kind: "every_meeting" },
          {
            version: 1,
            kind: "months",
            interval: 1,
            day: Number(addDays(sunday, 3).slice(-2)),
          },
        ]) {
          const { ward, data } = await fixture(
            `Restore suggestion ${recurrence.kind}`,
          );
          const input = {
            title: "Customized suggestion",
            durationMinutes: 9,
            anchorDate:
              recurrence.kind === "months" ? addDays(sunday, 3) : sunday,
            recurrence,
            suggestionKey: "assignments",
          };
          await execute(ward.id, {
            kind: "add",
            meetingId: data.meeting.id,
            input,
            requestId: randomUUID(),
          });
          let current = await load(ward.id, "bishopric", data.meeting.id);
          const row = current.items[0];
          assert.equal(current.activeSuggestions[0].onAgenda, true);
          input.title = "Current meeting wording";
          input.durationMinutes = 14;
          await execute(ward.id, {
            kind: "edit",
            itemId: row.id,
            input,
            scope: "this",
          });
          await execute(ward.id, { kind: "remove", itemId: row.id });
          current = await load(ward.id, "bishopric", data.meeting.id);
          assert.equal(current.items.length, 0);
          assert.equal(current.activeSuggestions[0].restoreItemId, row.id);
          assert.equal(current.activeSuggestions[0].title, input.title);
          assert.equal(current.activeSuggestions[0].durationMinutes, 14);
          await assert.rejects(
            execute(ward.id, {
              kind: "add",
              meetingId: data.meeting.id,
              input: { ...input, title: "Must not silently ignore edits" },
              requestId: randomUUID(),
            }),
            /already scheduled/,
          );
          await execute(ward.id, { kind: "restore", itemId: row.id });
          await execute(ward.id, { kind: "restore", itemId: row.id });
          current = await load(ward.id, "bishopric", data.meeting.id);
          assert.equal(current.items[0].title, input.title);
          assert.equal(current.items[0].durationMinutes, input.durationMinutes);
          assert.equal(
            await prisma.meeting_agenda_template.count({
              where: {
                series_id: data.series.id,
                archived: false,
                suggestion_key: "assignments",
              },
            }),
            1,
          );
          await execute(ward.id, {
            kind: "outcome",
            itemId: row.id,
            outcome: "continued",
            decision: "Continue this topic",
          });
          const next = data.meetings.find((m) => m.date > sunday);
          const carried = await load(ward.id, "bishopric", next.id);
          assert.equal(
            carried.items.filter((i) => i.title === input.title).length,
            1,
          );
          await execute(ward.id, {
            kind: "outcome",
            itemId: carried.items[0].id,
            outcome: "done",
            decision: "Finished",
          });
          await assert.rejects(
            execute(ward.id, { kind: "restore", itemId: carried.items[0].id }),
            /Only a removed/,
          );
          assert.equal(
            (await load(ward.id, "bishopric", next.id)).activeSuggestions[0]
              .restoreItemId,
            null,
          );
          await execute(ward.id, { kind: "stop", itemId: carried.items[0].id });
          assert.equal(
            (await load(ward.id, "bishopric", next.id)).activeSuggestions
              .length,
            0,
          );
          await execute(ward.id, {
            kind: "add",
            meetingId: next.id,
            input: { ...input, anchorDate: next.date },
            requestId: randomUUID(),
          });
          assert.equal(
            await prisma.meeting_agenda_template.count({
              where: {
                series_id: data.series.id,
                archived: false,
                suggestion_key: "assignments",
              },
            }),
            1,
          );
        }
      },
    );
    await t.test(
      "a removed one-time suggestion in closed history does not block a new discussion",
      async () => {
        const { ward, data } = await fixture("Historical one-time suggestion");
        const input = {
          title: "One-time suggestion",
          durationMinutes: 5,
          anchorDate: sunday,
          recurrence: { version: 1, kind: "once" },
          suggestionKey: "assignments",
        };
        await execute(ward.id, {
          kind: "add",
          meetingId: data.meeting.id,
          input,
          requestId: randomUUID(),
        });
        const original = (await load(ward.id, "bishopric", data.meeting.id))
          .items[0];
        await execute(ward.id, { kind: "remove", itemId: original.id });
        assert.equal(
          (await load(ward.id, "bishopric", data.meeting.id))
            .activeSuggestions[0].restoreItemId,
          original.id,
        );
        await execute(ward.id, {
          kind: "meeting",
          meetingId: data.meeting.id,
          operation: "close",
          unfinished: "skip",
        });
        const next = data.meetings.find((m) => m.date > sunday);
        assert.equal(
          (await load(ward.id, "bishopric", next.id)).activeSuggestions.length,
          0,
        );
        await execute(ward.id, {
          kind: "add",
          meetingId: next.id,
          input: { ...input, anchorDate: next.date },
          requestId: randomUUID(),
        });
        assert.equal(
          (await load(ward.id, "bishopric", next.id)).items.length,
          1,
        );
        assert.equal(
          (
            await prisma.meeting_agenda_item.findUnique({
              where: { id: original.id },
            })
          ).outcome,
          "removed",
        );
        await assert.rejects(
          execute(ward.id, { kind: "restore", itemId: original.id }),
          /read-only/,
        );
      },
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
