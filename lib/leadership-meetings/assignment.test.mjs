import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { addDays, localToday } from "./calendar.ts";
const directory = mkdtempSync(join(tmpdir(), "wardly-assignee-test-"));
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
const schedule = {
  version: 1,
  kind: "weeks",
  interval: 1,
  weekday: new Date(`${today}T12:00:00Z`).getUTCDay(),
};
async function fixture(kind = "bishopric") {
  const ward = await prisma.ward.create({ data: { name: "Assignments" } });
  const users = await Promise.all(
    ["Alice", "Ben", "Cara"].map((name) =>
      prisma.user.create({
        data: { ward_id: ward.id, name, email: `${randomUUID()}@example.test` },
      }),
    ),
  );
  await execute(ward.id, {
    kind: "initialize",
    meetingKind: kind,
    anchorDate: today,
    schedule,
    startTime: "09:00",
    targetMinutes: 60,
  });
  const data = await load(ward.id, kind);
  const input = {
    title: "Opening prayer",
    durationMinutes: 5,
    recurrence: { version: 1, kind: "every_meeting" },
    anchorDate: today,
    defaultAssignedUserId: users[0].id,
  };
  await execute(ward.id, {
    kind: "add",
    meetingId: data.meeting.id,
    requestId: randomUUID(),
    input,
  });
  const meetings = data.meetings;
  const at = (index) => load(ward.id, kind, meetings[index].id);
  const assign = async (index, userId) =>
    execute(ward.id, {
      kind: "assign",
      itemId: (await at(index)).items[0].id,
      assignment: { kind: "override", userId },
    });
  const edit = async (changes) =>
    execute(ward.id, {
      kind: "edit",
      itemId: (await at(0)).items[0].id,
      scope: "future",
      input: { ...input, ...changes },
    });
  return { ward, users, meetings, input, at, assign, edit, kind };
}
test("agenda assignees persist through meeting and series lifecycles", async (t) => {
  try {
    await t.test(
      "both meeting kinds inherit defaults, with different people per date and explicit clear/reset",
      async () => {
        for (const kind of ["bishopric", "ward_council"]) {
          const f = await fixture(kind);
          assert.equal((await f.at(0)).items[0].assignedUserId, f.users[0].id);
          await f.assign(0, f.users[1].id);
          await f.assign(1, f.users[2].id);
          assert.equal((await f.at(0)).items[0].assignedUserId, f.users[1].id);
          assert.equal((await f.at(1)).items[0].assignedUserId, f.users[2].id);
          await f.assign(1, null);
          assert.equal((await f.at(1)).items[0].assignedUserId, null);
          assert.equal((await f.at(1)).items[0].assignmentOverridden, true);
          await execute(f.ward.id, {
            kind: "assign",
            itemId: (await f.at(1)).items[0].id,
            assignment: { kind: "default" },
          });
          assert.equal((await f.at(1)).items[0].assignedUserId, f.users[0].id);
          assert.equal((await f.at(1)).items[0].assignmentOverridden, false);
        }
      },
    );
    await t.test(
      "default-only changes retain series identity, explicit clears/equal choices, active and resolved snapshots",
      async () => {
        const f = await fixture();
        await f.assign(1, null);
        await f.assign(2, f.users[0].id);
        const historical = (await f.at(3)).items[0];
        await execute(f.ward.id, {
          kind: "outcome",
          itemId: historical.id,
          outcome: "done",
          decision: "",
        });
        await execute(f.ward.id, {
          kind: "meeting",
          meetingId: f.meetings[4].id,
          operation: "start",
        });
        const count = await prisma.meeting_agenda_template.count({
          where: { series: { ward_id: f.ward.id } },
        });
        await f.edit({ defaultAssignedUserId: f.users[1].id });
        assert.equal(
          await prisma.meeting_agenda_template.count({
            where: { series: { ward_id: f.ward.id } },
          }),
          count,
        );
        assert.equal((await f.at(0)).items[0].assignedUserId, f.users[1].id);
        assert.equal((await f.at(1)).items[0].assignedUserId, null);
        assert.equal((await f.at(2)).items[0].assignedUserId, f.users[0].id);
        assert.equal((await f.at(3)).items[0].assignedUserId, f.users[0].id);
        assert.equal((await f.at(4)).items[0].assignedUserId, f.users[0].id);
        assert.equal((await f.at(5)).items[0].assignedUserId, f.users[1].id);
      },
    );
    await t.test(
      "editing a recurring series preserves future overrides while changing defaults",
      async () => {
        const f = await fixture();
        await f.assign(1, f.users[2].id);
        await f.assign(2, null);
        await f.edit({
          title: "Prayer and thought",
          durationMinutes: 8,
          defaultAssignedUserId: f.users[1].id,
        });
        assert.equal((await f.at(1)).items.length, 1);
        assert.equal((await f.at(1)).items[0].assignedUserId, f.users[2].id);
        assert.equal((await f.at(1)).items[0].title, "Prayer and thought");
        assert.equal((await f.at(2)).items[0].assignedUserId, null);
        assert.equal((await f.at(2)).items[0].assignmentOverridden, true);
        assert.equal((await f.at(3)).items[0].assignedUserId, f.users[1].id);
        assert.equal((await f.at(0)).items[0].assignedUserId, f.users[1].id);
        assert.equal(
          (await f.at(1)).items[0].defaultAssignedUserId,
          f.users[1].id,
        );
        await execute(f.ward.id, {
          kind: "assign",
          itemId: (await f.at(1)).items[0].id,
          assignment: { kind: "default" },
        });
        assert.equal((await f.at(1)).items[0].assignedUserId, f.users[1].id);
      },
    );
    await t.test(
      "editing a continuation's series keeps its inherited assignee",
      async () => {
        const f = await fixture();
        await execute(f.ward.id, {
          kind: "outcome",
          itemId: (await f.at(0)).items[0].id,
          outcome: "continued",
          decision: "Discuss again",
        });
        const carried = (await f.at(1)).items[0];
        await execute(f.ward.id, {
          kind: "edit",
          itemId: carried.id,
          scope: "future",
          input: {
            ...f.input,
            title: "Prayer and thought",
            defaultAssignedUserId: f.users[1].id,
          },
        });
        assert.equal((await f.at(1)).items[0].assignedUserId, f.users[0].id);
        assert.equal((await f.at(2)).items[0].assignedUserId, f.users[1].id);
      },
    );
    await t.test(
      "promoting a customized occurrence updates the recurring series",
      async () => {
        const f = await fixture();
        const item = (await f.at(0)).items[0];
        await execute(f.ward.id, {
          kind: "edit",
          itemId: item.id,
          scope: "this",
          input: { ...f.input, title: "Customized prayer", durationMinutes: 9 },
        });
        await f.edit({ title: "Customized prayer", durationMinutes: 9 });
        assert.equal((await f.at(1)).items[0].title, "Customized prayer");
        assert.equal((await f.at(1)).items[0].durationMinutes, 9);
      },
    );
    await t.test(
      "recurrence changes retain overrides on dates no longer generated and reset uses the replacement default",
      async () => {
        const f = await fixture();
        await f.assign(1, f.users[2].id);
        await f.edit({
          defaultAssignedUserId: f.users[1].id,
          recurrence: {
            version: 1,
            kind: "weeks",
            interval: 2,
            weekday: schedule.weekday,
          },
        });
        const preserved = (await f.at(1)).items[0];
        assert.equal(preserved.assignedUserId, f.users[2].id);
        assert.equal(preserved.defaultAssignedUserId, f.users[1].id);
        await execute(f.ward.id, {
          kind: "assign",
          itemId: preserved.id,
          assignment: { kind: "default" },
        });
        assert.equal((await f.at(1)).items[0].assignedUserId, f.users[1].id);
      },
    );
    await t.test(
      "continuation preserves assignees and keeps conflicting destination discussions",
      async () => {
        const f = await fixture();
        await f.assign(0, f.users[1].id);
        await f.assign(1, f.users[2].id);
        const source = (await f.at(0)).items[0];
        await execute(f.ward.id, {
          kind: "outcome",
          itemId: source.id,
          outcome: "continued",
          decision: "Continue",
        });
        const next = await f.at(1);
        assert.equal(next.items.length, 2);
        assert.deepEqual(
          new Set(next.items.map((i) => i.assignedUserId)),
          new Set([f.users[1].id, f.users[2].id]),
        );
        assert.equal(
          next.items.find((i) => i.predecessorId === source.id)
            .assignmentOverridden,
          true,
        );
      },
    );
    await t.test(
      "reschedule and schedule replacement preserve per-meeting assignments",
      async () => {
        const f = await fixture();
        await f.assign(0, null);
        await f.assign(1, f.users[1].id);
        await execute(f.ward.id, {
          kind: "reschedule",
          meetingId: f.meetings[0].id,
          date: addDays(today, 1),
          startTime: "10:00",
        });
        assert.equal((await f.at(0)).items[0].assignmentOverridden, true);
        const before = (await f.at(1)).items[0].id;
        await execute(f.ward.id, {
          kind: "schedule",
          seriesId: (await f.at(0)).series.id,
          anchorDate: today,
          schedule: { ...schedule, weekday: (schedule.weekday + 2) % 7 },
          startTime: "09:30",
          targetMinutes: 60,
        });
        const preserved = await prisma.meeting_agenda_item.findUniqueOrThrow({
          where: { id: before },
          include: { meeting: true },
        });
        assert.equal(preserved.assigned_user_id, f.users[1].id);
        assert.equal(preserved.assignment_overridden, true);
        assert.equal(preserved.meeting.status, "planned");
      },
    );
    await t.test(
      "one-time items support assignment; foreign users and resolved or closed changes are rejected",
      async () => {
        const f = await fixture();
        const foreign = await fixture();
        await assert.rejects(
          f.assign(0, foreign.users[0].id),
          /Assignee not found/,
        );
        await assert.rejects(
          f.edit({ defaultAssignedUserId: foreign.users[0].id }),
          /Assignee not found/,
        );
        await assert.rejects(
          execute(f.ward.id, {
            kind: "add",
            meetingId: f.meetings[0].id,
            requestId: randomUUID(),
            input: { ...f.input, defaultAssignedUserId: foreign.users[0].id },
          }),
          /Assignee not found/,
        );
        await execute(f.ward.id, {
          kind: "add",
          meetingId: f.meetings[0].id,
          requestId: randomUUID(),
          input: {
            ...f.input,
            title: "One-time",
            recurrence: { version: 1, kind: "once" },
          },
        });
        const once = (await f.at(0)).items.find((i) => i.title === "One-time");
        await execute(f.ward.id, {
          kind: "assign",
          itemId: once.id,
          assignment: { kind: "override", userId: f.users[1].id },
        });
        assert.equal(
          (await f.at(0)).items.find((i) => i.id === once.id).assignedUserId,
          f.users[1].id,
        );
        await execute(f.ward.id, {
          kind: "outcome",
          itemId: once.id,
          outcome: "done",
          decision: "",
        });
        await assert.rejects(
          execute(f.ward.id, {
            kind: "assign",
            itemId: once.id,
            assignment: { kind: "default" },
          }),
          /Only pending/,
        );
        await execute(f.ward.id, {
          kind: "meeting",
          meetingId: f.meetings[1].id,
          operation: "close",
          unfinished: "skip",
        });
        await assert.rejects(f.assign(1, null), /read-only/);
      },
    );
    await t.test(
      "deleting a user clears defaults and snapshots while retaining override provenance",
      async () => {
        const f = await fixture();
        await f.assign(1, f.users[0].id);
        await prisma.user.delete({ where: { id: f.users[0].id } });
        assert.equal((await f.at(0)).items[0].assignedUserId, null);
        assert.equal((await f.at(0)).items[0].defaultAssignedUserId, null);
        assert.equal((await f.at(1)).items[0].assignmentOverridden, true);
        assert.equal((await f.at(1)).items[0].assignedUserId, null);
      },
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
