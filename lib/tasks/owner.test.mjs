import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { bindActionsForTest } from "../actions/test-support.mjs";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/cache") return {
      shortCircuit: true,
      url: "data:text/javascript,export function revalidatePath() {}",
    };
    if (specifier === "@/lib/auth/dal") return {
      shortCircuit: true,
      url: 'data:text/javascript,export async function getSessionUser() { return { id: "actor", ward_id: "ward" }; }',
    };
    return nextResolve(specifier, context);
  },
});

const directory = mkdtempSync(join(tmpdir(), "wardly-owner-test-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
const sqlite = new Database(join(directory, "test.db"));
const migrations = new URL("../../prisma/migrations/", import.meta.url);
for (const name of readdirSync(migrations).filter((name) => /^\d/.test(name)).sort()) {
  sqlite.exec(readFileSync(new URL(`${name}/migration.sql`, migrations), "utf8"));
}
sqlite.close();
const { prisma } = await import("../prisma.ts");
const actions = await import("../../app/tasks/actions.ts");
const { createTask, updateTaskOwner, updateTaskAssignee, changeTaskState, reopenTask } = bindActionsForTest(actions, { userId: "actor", wardId: "ward" });
const { executeMeetingCommand } = await import("../leadership-meetings/service.ts");
const { loadLeadershipMeeting } = await import("../leadership-meetings/loaders.ts");
const { sendDueTaskDigests } = await import("./reminder-service.ts");
const stored = (id) => prisma.task.findUniqueOrThrow({ where: { id } });

test("task owner persists independently through creation, editing, workflow, and meeting retries", async (t) => {
  try {
    await prisma.ward.create({ data: { id: "ward", name: "Ward", time_zone: "UTC", sacrament_start_time: "09:00" } });
    await prisma.ward.create({ data: { id: "foreign", name: "Other ward" } });
    await prisma.user.createMany({ data: [
      { id: "actor", ward_id: "ward", name: "Alice", email: "alice@example.test" },
      { id: "bob", ward_id: "ward", name: "Bob", email: "bob@example.test" },
      { id: "carol", ward_id: "ward", name: "Carol", email: "carol@example.test" },
      { id: "outsider", ward_id: "foreign", name: "Other", email: "other@example.test" },
    ] });

    await t.test("quick entry copies the normalized initial assignee into owner", async () => {
      for (const [title, assignedUserId] of [["Assigned", "actor"], ["Unassigned", null], ["Empty", ""]]) {
        await createTask({ type: "todo", title, assignedUserId });
        const task = await prisma.task.findFirstOrThrow({ where: { title } });
        assert.equal(task.assigned_user_id, assignedUserId || null);
        assert.equal(task.owner_user_id, assignedUserId || null);
      }
      await assert.rejects(createTask({ type: "todo", title: "Foreign assignee", assignedUserId: "outsider" }), /Invalid assignee/);
    });

    const task = await prisma.task.findFirstOrThrow({ where: { title: "Assigned" } });
    await t.test("owner edits and clearing preserve assignee and reject foreign or missing users and tasks", async () => {
      await updateTaskOwner(task.id, "carol");
      assert.equal((await stored(task.id)).owner_user_id, "carol");
      assert.equal((await stored(task.id)).assigned_user_id, "actor");
      for (const owner of ["outsider", "missing"]) {
        await assert.rejects(updateTaskOwner(task.id, owner), /Invalid owner/);
        assert.equal((await stored(task.id)).owner_user_id, "carol");
      }
      const foreign = await prisma.task.create({ data: { ward_id: "foreign", type: "todo", owner_user_id: "outsider" } });
      await assert.rejects(updateTaskOwner(foreign.id, "actor"), /Task not found/);
      await assert.rejects(updateTaskOwner("missing", null), /Task not found/);
      assert.equal((await stored(foreign.id)).owner_user_id, "outsider");
      for (const empty of [null, ""]) {
        await updateTaskOwner(task.id, "carol");
        await updateTaskOwner(task.id, empty);
        assert.equal((await stored(task.id)).owner_user_id, null);
        assert.equal((await stored(task.id)).assigned_user_id, "actor");
      }
      const stale = await actions.updateTaskOwner({ userId: "outsider", wardId: "foreign" }, task.id, "carol");
      assert.deepEqual(stale, { ok: false, authError: "session_changed" });
      assert.equal((await stored(task.id)).owner_user_id, null);
    });

    await t.test("direct and configured reassignment, completion, and reopening retain independent owner", async () => {
      await updateTaskOwner(task.id, "carol");
      await updateTaskAssignee(task.id, "bob");
      assert.equal((await stored(task.id)).owner_user_id, "carol");
      await prisma.task_type_state_assignment.create({ data: { ward_id: "ward", task_type: "todo", state: "done", assign_to_user_id: "actor" } });
      await Promise.all([changeTaskState(task.id, "done"), updateTaskOwner(task.id, "bob")]);
      let saved = await stored(task.id);
      assert.equal(saved.owner_user_id, "bob");
      assert.equal(saved.assigned_user_id, "actor");
      assert.ok(saved.completed_at);
      await reopenTask(task.id);
      saved = await stored(task.id);
      assert.equal(saved.owner_user_id, "bob");
      assert.equal(saved.assigned_user_id, "actor");
      assert.equal(saved.completed_at, null);
      await updateTaskAssignee(task.id, null);
      assert.equal((await stored(task.id)).owner_user_id, "bob");
    });

    await t.test("meeting follow-up initializes ownership once and replay preserves edited or cleared owner", async () => {
      await executeMeetingCommand("ward", { kind: "initialize", meetingKind: "bishopric", anchorDate: "2026-11-01", schedule: { version: 1, kind: "weeks", interval: 1, weekday: 0 }, startTime: "09:00", targetMinutes: 60 });
      let meeting = await loadLeadershipMeeting("ward", "bishopric");
      await executeMeetingCommand("ward", { kind: "add", meetingId: meeting.meeting.id, requestId: randomUUID(), input: { title: "Follow-up", durationMinutes: 5, recurrence: { version: 1, kind: "once" }, anchorDate: meeting.meeting.date } });
      meeting = await loadLeadershipMeeting("ward", "bishopric", meeting.meeting.id);
      const itemId = meeting.items.find((item) => item.title === "Follow-up").id;
      for (const assignee of ["actor", null, ""]) {
        const command = { kind: "task", itemId, requestId: randomUUID(), title: "Meeting task", assignedUserId: assignee };
        await executeMeetingCommand("ward", command);
        const first = await stored(command.requestId);
        assert.equal(first.owner_user_id, assignee || null);
        assert.equal(first.assigned_user_id, assignee || null);
        for (const owner of ["carol", null]) {
          await updateTaskOwner(first.id, owner);
          await executeMeetingCommand("ward", command);
          const replayed = await stored(first.id);
          assert.equal(replayed.owner_user_id, owner);
          assert.equal(replayed.assigned_user_id, assignee || null);
          assert.equal(await prisma.meeting_agenda_item_task.count({ where: { item_id: itemId, task_id: first.id } }), 1);
        }
      }
    });

    await t.test("reminders include owners while the existing user.task inverse uses assignee", async () => {
      await prisma.task.updateMany({ where: { ward_id: "ward" }, data: { completed_at: "2026-10-30" } });
      const reminder = await prisma.task.create({ data: { ward_id: "ward", type: "todo", title: "Assigned reminder", assigned_user_id: "actor", owner_user_id: "bob" } });
      const alice = await prisma.user.findUniqueOrThrow({ where: { id: "actor" }, include: { task: { where: { completed_at: null } }, owned_tasks: { where: { completed_at: null } } } });
      assert.deepEqual(alice.task.map((task) => task.id), [reminder.id]);
      assert.equal(alice.owned_tasks.length, 0);
      const messages = [];
      assert.deepEqual(await sendDueTaskDigests({ now: () => new Date("2026-11-01T08:00:00Z"), baseUrl: "https://ward.test", send: async (mail) => messages.push(mail) }), { sent: 2, failed: 0 });
      messages.sort((a, b) => a.to.localeCompare(b.to));
      assert.equal(messages[1].to, "bob@example.test");
      assert.deepEqual(messages[1].tasks[0].assignment, { kind: "other", name: "Alice" });
      assert.equal(messages[0].to, "alice@example.test");
      assert.deepEqual(messages[0].tasks.map((task) => task.title), ["Assigned reminder"]);
    });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
