import { prisma } from "@/lib/prisma";
import { loadTaskTypes } from "@/lib/tasks/loader";
import { addTaskItemInTransaction } from "./task-item-service.ts";
import type { Transaction } from "./rules.ts";
import {
  isSundayMeetingTaskItemType,
  type SundayMeetingTaskCandidateGroup,
  type SundayMeetingTaskItemType,
} from "./types.ts";

function stateKey(taskType: string, state: string): string {
  return `${taskType}\u0000${state}`;
}

export async function loadSundayMeetingTaskCandidates(
  wardId: string,
  db: Transaction = prisma,
): Promise<SundayMeetingTaskCandidateGroup[]> {
  const [taskTypes, tasks] = await Promise.all([
    loadTaskTypes(wardId, db),
    db.task.findMany({
      where: { ward_id: wardId },
      include: {
        member: { select: { first_name: true, last_name: true } },
        sunday_meeting_item: {
          select: { sunday_meeting: { select: { id: true, date: true } } },
        },
      },
      orderBy: [{ type: "asc" }, { created_at: "asc" }],
    }),
  ]);

  const itemTypeByState = new Map<string, SundayMeetingTaskItemType>();
  for (const taskType of taskTypes) {
    for (const state of taskType.states) {
      if (state.sunday_meeting_item_type) {
        itemTypeByState.set(
          stateKey(taskType.type, state.state),
          state.sunday_meeting_item_type,
        );
      }
    }
  }

  const groups = new Map<
    SundayMeetingTaskItemType,
    SundayMeetingTaskCandidateGroup
  >();
  for (const task of tasks) {
    const itemType = itemTypeByState.get(stateKey(task.type, task.state));
    if (!itemType) {
      continue;
    }
    const memberName = task.member
      ? `${task.member.first_name} ${task.member.last_name}`.trim()
      : null;
    const group = groups.get(itemType) ?? { itemType, items: [] };
    group.items.push({
      id: task.id,
      itemType,
      title: task.title,
      description: task.description,
      memberName,
      scheduledMeeting: task.sunday_meeting_item[0]?.sunday_meeting ?? null,
    });
    groups.set(itemType, group);
  }

  return [...groups.values()];
}

export async function addSuggestedTasksToMeeting(
  wardId: string,
  meetingId: string,
  taskIds: string[],
): Promise<string[]> {
  if (
    !Array.isArray(taskIds) ||
    !taskIds.length ||
    taskIds.some((id) => typeof id !== "string" || !id)
  ) {
    throw new Error("Select at least one task.");
  }
  return prisma.$transaction(async (tx) => {
    const candidates = (
      await loadSundayMeetingTaskCandidates(wardId, tx)
    ).flatMap((group) => group.items);
    const ids: string[] = [];
    for (const taskId of new Set(taskIds)) {
      const candidate = candidates.find((item) => item.id === taskId);
      if (!candidate || !isSundayMeetingTaskItemType(candidate.itemType)) {
        throw new Error(
          "Task is not currently suggested for a Sunday meeting.",
        );
      }
      ids.push(
        await addTaskItemInTransaction(
          tx,
          wardId,
          meetingId,
          taskId,
          candidate.itemType,
        ),
      );
    }
    return ids;
  });
}

export async function addSuggestedTaskToMeeting(
  wardId: string,
  meetingId: string,
  taskId: string,
): Promise<string> {
  return (await addSuggestedTasksToMeeting(wardId, meetingId, [taskId]))[0];
}
