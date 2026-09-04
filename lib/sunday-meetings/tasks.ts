import { prisma } from "@/lib/prisma";
import { loadTaskTypes } from "@/lib/tasks/loader";
import { addTaskItem } from "./service.ts";
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
): Promise<SundayMeetingTaskCandidateGroup[]> {
  const [taskTypes, tasks] = await Promise.all([
    loadTaskTypes(wardId),
    prisma.task.findMany({
      where: { ward_id: wardId },
      include: {
        member: { select: { first_name: true, last_name: true } },
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

  const groups = new Map<SundayMeetingTaskItemType, SundayMeetingTaskCandidateGroup>();
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
    });
    groups.set(itemType, group);
  }

  return [...groups.values()];
}

export async function addSuggestedTaskToMeeting(
  wardId: string,
  meetingId: string,
  taskId: string,
): Promise<string> {
  const candidates = await loadSundayMeetingTaskCandidates(wardId);
  const candidate = candidates
    .flatMap((group) => group.items)
    .find((item) => item.id === taskId);
  if (!candidate || !isSundayMeetingTaskItemType(candidate.itemType)) {
    throw new Error("Task is not currently suggested for a Sunday meeting.");
  }
  return addTaskItem(wardId, meetingId, taskId, candidate.itemType);
}
