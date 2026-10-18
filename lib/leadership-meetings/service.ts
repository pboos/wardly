import { saveDiscussionNotes } from "./notes-service";
import "server-only";
import { assignAgenda } from "./assignment";
import { saveFutureOrder } from "./ordering";
import { addSuggestions } from "./suggestion-service";
import { removeAgenda, restoreAgenda } from "./removal";
import { prisma } from "@/lib/prisma";
import { loadTaskTypes } from "@/lib/tasks/loader";
import { object, text } from "./calendar";
import { itemForWard, meetingForWard, type Db } from "./store";
import {
  requestUuid,
  addAgenda,
  editAgenda,
  recordOutcome,
  stopRepeating,
} from "./item-service";
import { changeMeeting, reschedule, saveSchedule } from "./meeting-service";
import type { MeetingCommand } from "./types";
async function linkTask(
  db: Db,
  wardId: string,
  itemId: string,
  taskId: string,
) {
  await itemForWard(db, wardId, text(itemId), false);
  const task = await db.task.findFirst({
    where: { id: text(taskId), ward_id: wardId },
  });
  if (!task) throw new Error("Task not found.");
  await db.meeting_agenda_item_task.upsert({
    where: { item_id_task_id: { item_id: itemId, task_id: taskId } },
    create: { item_id: itemId, task_id: taskId },
    update: {},
  });
}
export async function executeMeetingCommand(
  wardId: string,
  input: MeetingCommand,
) {
  object(input);
  return prisma.$transaction(
    async (db) => {
      switch (input.kind) {
        case "initialize":
          await saveSchedule(db, wardId, input, { kind: input.meetingKind });
          break;
        case "schedule":
          await saveSchedule(db, wardId, input, { id: input.seriesId });
          break;
        case "meeting":
          await changeMeeting(
            db,
            wardId,
            input.meetingId,
            input.operation,
            input.unfinished,
          );
          break;
        case "reschedule":
          await reschedule(
            db,
            wardId,
            input.meetingId,
            input.date,
            input.startTime,
          );
          break;
        case "add-suggestion":
          await addSuggestions(
            db,
            wardId,
            text(input.meetingId),
            input.requestId,
            { kind: "one", key: text(input.suggestionKey) },
          );
          break;
        case "add-all-suggestions":
          await addSuggestions(
            db,
            wardId,
            text(input.meetingId),
            input.requestId,
            { kind: "all" },
          );
          break;
        case "add":
          object(input.input);
          await addAgenda(
            db,
            wardId,
            input.meetingId,
            input.input,
            input.requestId,
          );
          break;
        case "edit":
          object(input.input);
          await editAgenda(
            db,
            wardId,
            text(input.itemId),
            input.input,
            input.scope,
          );
          break;
        case "assign":
          await assignAgenda(db, wardId, text(input.itemId), input.assignment);
          break;
        case "outcome":
          await recordOutcome(
            db,
            wardId,
            text(input.itemId),
            input.outcome,
            input.decision,
            input.expectedDecision,
            input.sharedNotes,
          );
          break;
        case "notes":
          await saveDiscussionNotes(db, wardId, { ...input, itemId: text(input.itemId) });
          break;
        case "reorder": {
          const meeting = await meetingForWard(
            db,
            wardId,
            text(input.meetingId),
          );
          const rows = await db.meeting_agenda_item.findMany({
            where: { meeting_id: meeting.id, outcome: { not: "removed" } },
            select: { id: true },
          });
          if (
            !Array.isArray(input.itemIds) ||
            input.itemIds.length !== rows.length ||
            new Set(input.itemIds).size !== rows.length ||
            rows.some((row) => !input.itemIds.includes(row.id))
          )
            throw new Error("The agenda changed. Refresh before reordering.");
          for (const [position, id] of input.itemIds.entries())
            await db.meeting_agenda_item.update({
              where: { id },
              data: { position },
            });
          break;
        }
        case "save-future-order":
          await saveFutureOrder(
            db,
            wardId,
            text(input.meetingId),
            input.itemIds,
          );
          break;
        case "remove":
          await removeAgenda(db, wardId, text(input.itemId), input.scope);
          break;
        case "restore":
          await restoreAgenda(db, wardId, text(input.itemId));
          break;
        case "stop":
          await stopRepeating(db, wardId, text(input.itemId));
          break;
        case "move": {
          const item = await itemForWard(db, wardId, text(input.itemId));
          if (input.direction !== -1 && input.direction !== 1)
            throw new Error("Invalid direction.");
          const items = await db.meeting_agenda_item.findMany({
            where: { meeting_id: item.meeting_id, outcome: { not: "removed" } },
            orderBy: [{ position: "asc" }, { id: "asc" }],
          });
          const index = items.findIndex((i) => i.id === item.id),
            to = index + input.direction;
          if (to < 0 || to >= items.length) break;
          [items[index], items[to]] = [items[to], items[index]];
          for (const [position, row] of items.entries())
            await db.meeting_agenda_item.update({
              where: { id: row.id },
              data: { position },
            });
          break;
        }
        case "link":
          await linkTask(db, wardId, input.itemId, input.taskId);
          break;
        case "task": {
          await itemForWard(db, wardId, text(input.itemId), false);
          const title = text(input.title),
            id = requestUuid(input.requestId);
          const existing = await db.task.findUnique({ where: { id } });
          if (existing) {
            if (existing.ward_id !== wardId)
              throw new Error("Invalid request identifier.");
            await linkTask(db, wardId, input.itemId, id);
            break;
          }
          const definition = (await loadTaskTypes(wardId, db)).find(
            (t) => t.type === "todo" && t.enabled,
          );
          const initial = definition?.states[0];
          if (
            !definition ||
            !initial ||
            !definition.configuration.showTaskTitle
          )
            throw new Error(
              "Enable the Task type with a title and initial state in task settings first.",
            );
          const assignee = input.assignedUserId;
          if (
            assignee &&
            !(await db.user.findFirst({
              where: { id: text(assignee), ward_id: wardId },
            }))
          )
            throw new Error("Assignee not found.");
          await db.task.create({
            data: {
              id,
              ward_id: wardId,
              type: definition.type,
              state: initial.state,
              title,
              assigned_user_id: assignee,
              duration_minutes:
                definition.configuration.durationMinutes ?? null,
              completed_at:
                initial.state_group === "closed"
                  ? new Date().toISOString()
                  : null,
            },
          });
          await linkTask(db, wardId, input.itemId, id);
          break;
        }
        default:
          throw new Error("Unknown meeting action.");
      }
    },
    { timeout: 30000 },
  );
}
