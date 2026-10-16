import {
  addDays,
  dateString,
  integer,
  localToday,
  parseRule,
  scheduleThrough,
  text,
  type CalendarRule,
} from "./calendar";
import {
  meetingForWard,
  mergeAppearance,
  nextMeeting,
  reconcile,
  seriesForWard,
  type Db,
} from "./store";
import { insertionPosition } from "./ordering";
import { recordOutcome } from "./item-service";
import type { MeetingKind } from "./types";
export function timeString(value: unknown): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("Choose a valid start time.");
  return value;
}
export async function saveSchedule(
  db: Db,
  wardId: string,
  input: {
    anchorDate: string;
    schedule: CalendarRule;
    startTime: string;
    targetMinutes: number;
  },
  target: { kind: MeetingKind } | { id: string },
) {
  const anchor = dateString(input.anchorDate),
    rule = parseRule(input.schedule);
  if (!["weeks", "ordinal"].includes(rule.kind))
    throw new Error("Choose a weekly or monthly weekday schedule.");
  if (rule.kind === "ordinal" && rule.ordinal === 5)
    throw new Error(
      "Meeting schedules use first through fourth, or last, weekdays so every interval has a meeting.",
    );
  const ward = await db.ward.findUniqueOrThrow({ where: { id: wardId } });
  const today = localToday(ward.time_zone);
  const previous =
    "id" in target ? await seriesForWard(db, wardId, text(target.id)) : null;
  const previousAnchor = previous
    ? (JSON.parse(previous.schedule) as { anchor: string }).anchor
    : null;
  if (
    (anchor < today && anchor !== previousAnchor) ||
    anchor > addDays(today, 366)
  )
    throw new Error("Start the schedule within the next year.");
  const data = {
    schedule: JSON.stringify({ anchor, rule }),
    start_time: timeString(input.startTime),
    target_minutes: integer(input.targetMinutes, 10, 240),
    time_zone: ward.time_zone,
    updated_at: new Date(),
  };
  let series;
  if ("id" in target) {
    series = await db.leadership_meeting_series.update({
      where: { id: target.id },
      data,
    });
    const replaceable = await db.leadership_meeting.findMany({
      where: {
        series_id: series.id,
        date: { gte: today, lte: scheduleThrough(today) },
        status: "planned",
        items: {
          none: {
            OR: [
              { outcome: { notIn: ["pending", "removed"] } },
              { decision: { not: "" } },
            ],
          },
        },
      },
      select: { id: true, date: true, scheduled_date: true },
    });
    await db.leadership_meeting.updateMany({
      where: {
        id: {
          in: replaceable
            .filter((m) => m.date === m.scheduled_date)
            .map((m) => m.id),
        },
      },
      data: { status: "superseded" },
    });
  } else {
    if (!["bishopric", "ward_council"].includes(target.kind))
      throw new Error("Unknown meeting type.");
    series = await db.leadership_meeting_series.upsert({
      where: { ward_id_kind: { ward_id: wardId, kind: target.kind } },
      create: { ward_id: wardId, kind: target.kind, ...data },
      update: {},
    });
  }
  await reconcile(db, series.id);
  const stranded = await db.meeting_agenda_item.findMany({
    where: {
      meeting: { series_id: series.id, status: "superseded" },
      outcome: "pending",
    },
    include: {
      meeting: true,
      tasks: true,
      occurrences: { include: { occurrence: { include: { template: true } } } },
    },
  });
  for (const item of stranded) {
    const automaticStanding =
      !item.predecessor_id &&
      !item.decision &&
      !item.tasks.length &&
      item.occurrences.every((o) => {
        const template = o.occurrence.template;
        return (
          parseRule(JSON.parse(template.recurrence)).kind === "every_meeting" &&
          item.title === template.title &&
          item.duration_minutes === template.duration_minutes
        );
      });
    if (automaticStanding) {
      await db.meeting_agenda_occurrence.updateMany({
        where: { id: { in: item.occurrences.map((o) => o.occurrence_id) } },
        data: { status: "retired" },
      });
      await db.meeting_agenda_item.delete({ where: { id: item.id } });
      continue;
    }
    const destination = await nextMeeting(
      db,
      series.id,
      addDays(item.meeting.date > today ? item.meeting.date : today, -1),
    );
    const templateIds = item.occurrences.map((o) => o.occurrence.template_id);
    const generated = await db.meeting_agenda_item.findMany({
      where: {
        meeting_id: destination.id,
        outcome: "pending",
        predecessor_id: null,
        decision: "",
        tasks: { none: {} },
        occurrences: {
          some: { occurrence: { template_id: { in: templateIds } } },
        },
      },
      include: {
        occurrences: {
          include: { occurrence: { include: { template: true } } },
        },
      },
    });
    let inheritedPosition: number | undefined;
    for (const duplicate of generated) {
      const pristine = duplicate.occurrences.every(
        (o) =>
          duplicate.title === o.occurrence.template.title &&
          duplicate.duration_minutes === o.occurrence.template.duration_minutes,
      );
      if (pristine) {
        inheritedPosition ??= duplicate.position;
        await mergeAppearance(db, item.id, duplicate.id);
      }
    }
    await db.meeting_agenda_item.update({
      where: { id: item.id },
      data: {
        meeting_id: destination.id,
        position:
          inheritedPosition ??
          (await insertionPosition(
            db,
            destination.id,
            item.occurrences.map((o) => o.occurrence_id),
            item.id,
          )),
      },
    });
  }
  return series.id;
}
export async function changeMeeting(
  db: Db,
  wardId: string,
  meetingId: string,
  operation: "start" | "cancel" | "close",
  unfinished?: "defer" | "skip",
) {
  const meeting = await meetingForWard(db, wardId, text(meetingId), false);
  if (operation === "start") {
    if (meeting.status === "active") return;
    if (meeting.status !== "planned")
      throw new Error("Only planned meetings can start.");
    await reconcile(db, meeting.series_id);
    await db.leadership_meeting.update({
      where: { id: meeting.id },
      data: { status: "active", updated_at: new Date() },
    });
    return;
  }
  const status = operation === "cancel" ? "cancelled" : "closed";
  if (meeting.status === status) return;
  if (!["planned", "active"].includes(meeting.status))
    throw new Error("This meeting is read-only.");
  if (operation === "cancel" && meeting.status !== "planned")
    throw new Error("Close a started meeting instead of cancelling it.");
  if (operation !== "close" && operation !== "cancel")
    throw new Error("Unknown meeting operation.");
  const pending = await db.meeting_agenda_item.findMany({
    where: { meeting_id: meeting.id, outcome: "pending" },
  });
  if (pending.length && unfinished !== "skip" && unfinished !== "defer")
    throw new Error("Choose what to do with unfinished items.");
  for (const item of pending)
    await recordOutcome(
      db,
      wardId,
      item.id,
      unfinished === "skip" ? "skipped" : "deferred",
      item.decision,
    );
  await db.leadership_meeting.update({
    where: { id: meeting.id },
    data: { status, updated_at: new Date() },
  });
  await reconcile(db, meeting.series_id);
}
export async function reschedule(
  db: Db,
  wardId: string,
  meetingId: string,
  date: string,
  startTime: string,
) {
  const meeting = await meetingForWard(db, wardId, text(meetingId));
  if (meeting.status !== "planned")
    throw new Error("Only unstarted meetings can be rescheduled.");
  date = dateString(date);
  if (date < localToday(meeting.series.time_zone))
    throw new Error("Choose today or a future date.");
  const collision = await db.leadership_meeting.findFirst({
    where: {
      series_id: meeting.series_id,
      date,
      id: { not: meeting.id },
      status: { in: ["planned", "active", "closed"] },
    },
  });
  if (collision) throw new Error("A meeting already exists on that date.");
  await db.leadership_meeting.update({
    where: { id: meeting.id },
    data: { date, start_time: timeString(startTime), updated_at: new Date() },
  });
  await reconcile(db, meeting.series_id);
}
