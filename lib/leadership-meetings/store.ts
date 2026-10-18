import { topicId } from "./topics";
import "server-only";
import { canMergeInstructions, mergedInstructions } from "./instructions";
import { canMergeAssignments, mergedAssignment } from "./assignment";
import { insertionPosition } from "./ordering";
import type { Prisma } from "@/generated/prisma/client";
import {
  addDays,
  datesBetween,
  localToday,
  matches,
  parseRule,
} from "./calendar";
export { reconcile } from "./reconcile";
export type Db = Prisma.TransactionClient;
export async function seriesForWard(db: Db, wardId: string, id: string) {
  const series = await db.leadership_meeting_series.findFirst({
    where: { id, ward_id: wardId },
  });
  if (!series) throw new Error("Meeting series not found.");
  return series;
}
export async function meetingForWard(
  db: Db,
  wardId: string,
  id: string,
  editable = true,
) {
  const meeting = await db.leadership_meeting.findFirst({
    where: { id, series: { ward_id: wardId } },
    include: { series: true },
  });
  if (!meeting) throw new Error("Meeting not found.");
  if (editable && !["planned", "active"].includes(meeting.status))
    throw new Error("This meeting is read-only.");
  return meeting;
}
export async function itemForWard(
  db: Db,
  wardId: string,
  id: string,
  editable = true,
) {
  const item = await db.meeting_agenda_item.findFirst({
    where: { id, meeting: { series: { ward_id: wardId } } },
    include: {
      meeting: true,
      occurrences: { include: { occurrence: { include: { template: true } } } },
      successor: true,
    },
  });
  if (!item) throw new Error("Agenda item not found.");
  if (
    !editable &&
    (item.outcome === "removed" || item.meeting.status === "superseded")
  )
    throw new Error("This discussion is no longer visible.");
  if (editable && !["planned", "active"].includes(item.meeting.status))
    throw new Error("This meeting is read-only.");
  return item;
}
export async function createAppearance(
  db: Db,
  meetingId: string,
  title: string,
  duration: number,
  occurrenceIds: string[],
  predecessorId?: string,
  assignment?: {
    assigned_user_id: string | null;
    assignment_overridden: boolean;
    instructions: string;
  },
) {
  const position = await insertionPosition(db, meetingId, occurrenceIds);
  const template = await db.meeting_agenda_occurrence.findFirst({
    where: { id: { in: occurrenceIds } },
    include: { template: true },
  });
  return db.meeting_agenda_item.create({
    data: {
      meeting_id: meetingId,
      assigned_user_id:
        assignment?.assigned_user_id ??
        (assignment ? null : template?.template.default_assigned_user_id),
      assignment_overridden: assignment?.assignment_overridden ?? false,
      title,
      instructions:
        assignment?.instructions ?? template?.template.instructions ?? "",
      duration_minutes: duration,
      position,
      predecessor_id: predecessorId,
      occurrences: {
        create: occurrenceIds.map((occurrence_id) => ({ occurrence_id })),
      },
    },
  });
}
export async function ensureSchedule(
  db: Db,
  seriesId: string,
  through: string,
) {
  const series = await db.leadership_meeting_series.findUniqueOrThrow({
    where: { id: seriesId },
  });
  const schedule = JSON.parse(series.schedule) as {
    anchor: string;
    rule: unknown;
  };
  const rule = parseRule(schedule.rule);
  const today = localToday(series.time_zone);
  const dates = datesBetween(rule, schedule.anchor, today, through);
  const meetings = await db.leadership_meeting.findMany({
    where: { series_id: seriesId },
  });
  const byScheduledDate = new Map(
    meetings.map((meeting) => [meeting.scheduled_date, meeting]),
  );
  const occupiedDates = new Map<string, Set<string>>();
  for (const meeting of meetings) {
    if (!["planned", "active", "closed"].includes(meeting.status)) continue;
    const occupants = occupiedDates.get(meeting.date) ?? new Set<string>();
    occupants.add(meeting.id);
    occupiedDates.set(meeting.date, occupants);
  }
  for (const date of dates) {
    const existing = byScheduledDate.get(date);
    if (!existing && date < today) continue;
    const collision = [...(occupiedDates.get(date) ?? [])].some(
      (id) => id !== existing?.id,
    );
    if (collision || (existing && existing.status !== "superseded")) continue;
    const saved = await db.leadership_meeting.upsert({
      where: {
        series_id_scheduled_date: { series_id: seriesId, scheduled_date: date },
      },
      create: {
        series_id: seriesId,
        scheduled_date: date,
        date,
        start_time: series.start_time,
      },
      update:
        existing?.status === "superseded"
          ? { status: "planned", start_time: series.start_time }
          : {},
    });
    byScheduledDate.set(date, saved);
    if (["planned", "active", "closed"].includes(saved.status)) {
      const occupants = occupiedDates.get(saved.date) ?? new Set<string>();
      occupants.add(saved.id);
      occupiedDates.set(saved.date, occupants);
    }
  }
}
export async function nextMeeting(db: Db, seriesId: string, after: string) {
  const series = await db.leadership_meeting_series.findUniqueOrThrow({
    where: { id: seriesId },
  });
  const schedule = JSON.parse(series.schedule) as {
    anchor: string;
    rule: unknown;
  };
  const rule = parseRule(schedule.rule);
  let next = await db.leadership_meeting.findFirst({
    where: { series_id: seriesId, date: { gt: after }, status: "planned" },
    orderBy: { date: "asc" },
  });
  const today = localToday(series.time_zone);
  const from = after < today ? today : addDays(after, 1);
  const limit = next?.date ?? "2100-12-31";
  for (
    let date = from > schedule.anchor ? from : schedule.anchor;
    date <= limit;
    date = addDays(date, 1)
  ) {
    if (!matches(rule, schedule.anchor, date)) continue;
    if (next && date >= next.date) break;
    const existing = await db.leadership_meeting.findUnique({
      where: {
        series_id_scheduled_date: { series_id: seriesId, scheduled_date: date },
      },
    });
    if (existing && existing.status !== "superseded") continue;
    const collision = await db.leadership_meeting.findFirst({
      where: {
        series_id: seriesId,
        date,
        status: { in: ["planned", "active", "closed"] },
      },
    });
    if (collision) continue;
    next = await db.leadership_meeting.upsert({
      where: {
        series_id_scheduled_date: { series_id: seriesId, scheduled_date: date },
      },
      create: {
        series_id: seriesId,
        scheduled_date: date,
        date,
        start_time: series.start_time,
      },
      update: { status: "planned", start_time: series.start_time },
    });
    break;
  }
  if (!next)
    throw new Error("Schedule a future meeting before moving this item.");
  return next;
}

export async function mergeAppearance(
  db: Db,
  keeperId: string,
  duplicateId: string,
) {
  const duplicate = await db.meeting_agenda_item.findUniqueOrThrow({
    where: { id: duplicateId },
    include: {
      occurrences: { include: { occurrence: { include: { template: true } } } },
      tasks: true,
    },
  });
  const keeper = await db.meeting_agenda_item.findUniqueOrThrow({
    where: { id: keeperId },
    include: { occurrences: { include: { occurrence: { include: { template: true } } } } },
  });
  const defaults = duplicate.occurrences.map(
    (o) => o.occurrence.template.instructions,
  );
  if (
    topicId(keeper) !== topicId(duplicate) ||
    !canMergeAssignments(keeper, duplicate) ||
    !canMergeInstructions(keeper, duplicate, defaults)
  )
    return false;
  await db.meeting_agenda_item.update({
    where: { id: keeperId },
    data: {
      ...mergedAssignment(keeper, duplicate),
      instructions: mergedInstructions(keeper, duplicate, defaults),
    },
  });
  for (const occurrence of duplicate.occurrences)
    await db.meeting_agenda_item_occurrence.upsert({
      where: {
        item_id_occurrence_id: {
          item_id: keeperId,
          occurrence_id: occurrence.occurrence_id,
        },
      },
      create: { item_id: keeperId, occurrence_id: occurrence.occurrence_id },
      update: {},
    });
  for (const task of duplicate.tasks)
    await db.meeting_agenda_item_task.upsert({
      where: { item_id_task_id: { item_id: keeperId, task_id: task.task_id } },
      create: { item_id: keeperId, task_id: task.task_id },
      update: {},
    });
  await db.meeting_agenda_item.delete({ where: { id: duplicateId } });
  return true;
}
