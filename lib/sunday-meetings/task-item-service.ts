import { prisma } from "@/lib/prisma";
import { nextPosition } from "./order.ts";
import {
  meetingSortableItems,
  normalizeMeetingOrder,
} from "./order-service.ts";
import {
  isLocalMeetingType,
  isSundayMeetingTaskItemType,
  type SundayMeetingTaskItemType,
} from "./types.ts";
import {
  asMeetingType,
  fail,
  requireMeeting,
  type Transaction,
} from "./rules.ts";

export async function addTaskItemInTransaction(
  tx: Transaction,
  wardId: string,
  meetingId: string,
  taskId: string,
  itemType: SundayMeetingTaskItemType,
): Promise<string> {
  const meeting = await requireMeeting(tx, wardId, meetingId);
  if (!isLocalMeetingType(asMeetingType(meeting.type))) {
    fail("Conference meetings do not have a local agenda.");
  }
  if (!isSundayMeetingTaskItemType(itemType)) {
    fail("Task state has an invalid Sunday meeting item type.");
  }
  const task = await tx.task.findFirst({
    where: { id: taskId, ward_id: wardId },
    select: { id: true },
  });
  if (!task) {
    fail("Task not found in this ward.");
  }
  const duplicate = await tx.sunday_meeting_item.findFirst({
    where: { task_id: taskId },
  });
  if (duplicate?.sunday_meeting_id === meetingId) {
    fail("This task is already on the meeting agenda.");
  }

  const data = {
    sunday_meeting_id: meetingId,
    type: itemType,
    section: "business",
    order_index: nextPosition(
      await meetingSortableItems(tx, meetingId),
      "business",
    ),
    task_id: taskId,
    updated_at: new Date(),
  };
  if (duplicate) {
    await requireMeeting(tx, wardId, duplicate.sunday_meeting_id);
    await tx.sunday_meeting_item.update({ where: { id: duplicate.id }, data });
    await normalizeMeetingOrder(tx, duplicate.sunday_meeting_id);
    await normalizeMeetingOrder(tx, meetingId);
    return duplicate.id;
  }
  const created = await tx.sunday_meeting_item.create({ data });
  return created.id;
}

export async function addTaskItem(
  wardId: string,
  meetingId: string,
  taskId: string,
  itemType: SundayMeetingTaskItemType,
): Promise<string> {
  return prisma.$transaction((tx) =>
    addTaskItemInTransaction(tx, wardId, meetingId, taskId, itemType),
  );
}
