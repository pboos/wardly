import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  addDays,
  assignMeeting,
  datesBetween,
  localToday,
  parseRule,
} from "./calendar";
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
export async function itemForWard(db: Db, wardId: string, id: string) {
  const item = await db.meeting_agenda_item.findFirst({
    where: { id, meeting: { series: { ward_id: wardId } } },
    include: {
      meeting: true,
      occurrences: { include: { occurrence: { include: { template: true } } } },
      successor: true,
    },
  });
  if (!item) throw new Error("Agenda item not found.");
  if (!["planned", "active"].includes(item.meeting.status))
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
) {
  const max = await db.meeting_agenda_item.aggregate({
    where: { meeting_id: meetingId },
    _max: { position: true },
  });
  return db.meeting_agenda_item.create({
    data: {
      meeting_id: meetingId,
      title,
      duration_minutes: duration,
      position: (max._max.position ?? -1) + 1,
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
  const dates = datesBetween(rule, schedule.anchor, schedule.anchor, through);
  for (const date of dates) {
    const existing = await db.leadership_meeting.findUnique({
      where: {
        series_id_scheduled_date: { series_id: seriesId, scheduled_date: date },
      },
    });
    if (!existing && date < today) continue;
    const collision = await db.leadership_meeting.findFirst({
      where: {
        series_id: seriesId,
        date,
        status: { in: ["planned", "active", "closed"] },
        ...(existing ? { id: { not: existing.id } } : {}),
      },
    });
    if (collision) continue;
    await db.leadership_meeting.upsert({
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
  }
}
export async function reconcile(db: Db, seriesId: string, through: string) {
  await ensureSchedule(db, seriesId, through);
  const owner = await db.leadership_meeting_series.findUniqueOrThrow({
    where: { id: seriesId },
  });
  const today = localToday(owner.time_zone);
  const meetings = await db.leadership_meeting.findMany({
    where: { series_id: seriesId },
    orderBy: { date: "asc" },
  });
  const held = new Set(
    (
      await db.leadership_meeting.findMany({
        where: {
          series_id: seriesId,
          items: {
            some: {
              OR: [
                { outcome: { notIn: ["pending", "removed"] } },
                { decision: { not: "" } },
              ],
            },
          },
        },
        select: { id: true },
      })
    ).map((m) => m.id),
  );
  const templates = await db.meeting_agenda_template.findMany({
    where: { series_id: seriesId, archived: false },
  });
  for (const template of templates) {
    const rule = parseRule(JSON.parse(template.recurrence));
    const dues =
      rule.kind === "every_meeting"
        ? meetings
            .filter(
              (m) =>
                m.date >= template.anchor_date &&
                m.date >= today &&
                !["cancelled", "superseded"].includes(m.status),
            )
            .map((m) => ({ key: m.id, date: m.date, meetingId: m.id }))
        : datesBetween(
            rule,
            template.anchor_date,
            template.anchor_date,
            through,
          ).map((date) => ({ key: date, date, meetingId: null }));
    for (const due of dues) {
      if (template.after_date && due.date <= template.after_date) continue;
      const occurrence = await db.meeting_agenda_occurrence.upsert({
        where: {
          template_id_occurrence_key: {
            template_id: template.id,
            occurrence_key: due.key,
          },
        },
        create: {
          template_id: template.id,
          occurrence_key: due.key,
          due_date: due.date,
        },
        update: {},
        include: {
          appearances: {
            include: { item: { include: { meeting: true, tasks: true } } },
          },
        },
      });
      if (
        occurrence.status === "retired" &&
        due.meetingId &&
        meetings.some((m) => m.id === due.meetingId && m.status === "planned")
      ) {
        await db.meeting_agenda_occurrence.update({
          where: { id: occurrence.id },
          data: { status: "pending" },
        });
        occurrence.status = "pending";
      }
      if (occurrence.status !== "pending") continue;
      const existing = occurrence.appearances.find(
        (a) => a.item.outcome === "pending",
      );
      if (
        existing &&
        (existing.item.meeting.status === "active" ||
          held.has(existing.item.meeting_id) ||
          existing.item.predecessor_id)
      )
        continue;
      const target = due.meetingId
        ? meetings.find(
            (m) =>
              m.id === due.meetingId &&
              m.status === "planned" &&
              !held.has(m.id),
          )
        : assignMeeting(
            due.date,
            meetings
              .filter(
                (m) =>
                  !template.after_meeting_date ||
                  m.date > template.after_meeting_date,
              )
              .map((m) =>
                (m.date < today || held.has(m.id)) && m.status === "planned"
                  ? { ...m, status: "past" }
                  : m,
              ),
          );
      if (!target) continue;
      if (existing?.item.meeting_id === target.id) continue;
      const same = await db.meeting_agenda_item.findFirst({
        where: {
          meeting_id: target.id,
          outcome: "pending",
          occurrences: { some: { occurrence: { template_id: template.id } } },
        },
      });
      if (
        existing &&
        !same &&
        (await db.meeting_agenda_item_occurrence.count({
          where: { item_id: existing.item_id },
        })) === 1
      ) {
        await db.meeting_agenda_item.update({
          where: { id: existing.item_id },
          data: { meeting_id: target.id },
        });
        continue;
      }
      const destination =
        same ??
        (await createAppearance(
          db,
          target.id,
          existing?.item.title ?? template.title,
          existing?.item.duration_minutes ?? template.duration_minutes,
          [],
        ));
      await db.meeting_agenda_item_occurrence.upsert({
        where: {
          item_id_occurrence_id: {
            item_id: destination.id,
            occurrence_id: occurrence.id,
          },
        },
        create: { item_id: destination.id, occurrence_id: occurrence.id },
        update: {},
      });
      if (
        existing &&
        ["planned", "superseded"].includes(existing.item.meeting.status)
      ) {
        for (const task of existing.item.tasks)
          await db.meeting_agenda_item_task.upsert({
            where: {
              item_id_task_id: {
                item_id: destination.id,
                task_id: task.task_id,
              },
            },
            create: { item_id: destination.id, task_id: task.task_id },
            update: {},
          });
        if (
          existing.item.decision &&
          !destination.decision.includes(existing.item.decision)
        )
          await db.meeting_agenda_item.update({
            where: { id: destination.id },
            data: {
              decision: [destination.decision, existing.item.decision]
                .filter(Boolean)
                .join("\n"),
            },
          });
        await db.meeting_agenda_item_occurrence.delete({
          where: { id: existing.id },
        });
        if (
          (await db.meeting_agenda_item_occurrence.count({
            where: { item_id: existing.item_id },
          })) === 0
        )
          await db.meeting_agenda_item.delete({
            where: { id: existing.item_id },
          });
      }
    }
  }
}
export async function nextMeeting(db: Db, seriesId: string, after: string) {
  await ensureSchedule(db, seriesId, addDays(after, 800));
  const next = await db.leadership_meeting.findFirst({
    where: { series_id: seriesId, date: { gt: after }, status: "planned" },
    orderBy: { date: "asc" },
  });
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
    include: { occurrences: true, tasks: true },
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
}
