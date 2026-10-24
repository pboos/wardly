import "server-only";
import { canMergeInstructions, mergedInstructions } from "./instructions";
import { canMergeAssignments, mergedAssignment } from "./assignment";
import { insertionPosition } from "./ordering";
import { localToday, parseRule, scheduleThrough } from "./calendar";
import { recurrenceDues, targetForDue } from "./reconciliation-rules";
import { createAppearance, ensureSchedule, type Db } from "./store";

export async function reconcile(db: Db, seriesId: string) {
  const owner = await db.leadership_meeting_series.findUniqueOrThrow({
    where: { id: seriesId },
  });
  const today = localToday(owner.time_zone);
  const through = scheduleThrough(today);
  await ensureSchedule(db, seriesId, through);
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
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
  });
  const occurrences = await db.meeting_agenda_occurrence.findMany({
    where: { template_id: { in: templates.map((template) => template.id) } },
    include: {
      appearances: {
        include: { item: { include: { meeting: true, tasks: true } } },
      },
    },
  });
  const snapshot = new Map(
    occurrences.map((occurrence) => [
      `${occurrence.template_id}:${occurrence.occurrence_key}`,
      occurrence,
    ]),
  );
  let snapshotValid = true;
  for (const template of templates) {
    const rule = parseRule(JSON.parse(template.recurrence));
    const dues = recurrenceDues({ rule, template, meetings, today, through });
    for (const due of dues) {
      const cached = snapshotValid
        ? snapshot.get(`${template.id}:${due.key}`)
        : undefined;
      if (!cached) snapshotValid = false;
      const occurrence = cached ?? await db.meeting_agenda_occurrence.upsert({
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
        snapshotValid = false;
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
        !existing &&
        occurrence.appearances.some((a) => a.item.outcome === "removed")
      )
        continue;
      if (
        existing &&
        (existing.item.meeting.status === "active" ||
          held.has(existing.item.meeting_id) ||
          existing.item.predecessor_id)
      )
        continue;
      const target = targetForDue({ due, template, meetings, today, held });
      if (!target) continue;
      if (existing?.item.meeting_id === target.id) continue;
      snapshotValid = false;
      const candidates = await db.meeting_agenda_item.findMany({
        where: {
          meeting_id: target.id,
          outcome: "pending",
          occurrences: { some: { occurrence: { template_id: template.id } } },
        },
      });
      const same = candidates.find(
        (candidate) =>
          !existing ||
          (canMergeAssignments(candidate, existing.item) &&
            canMergeInstructions(candidate, existing.item, [
              template.instructions,
            ])),
      );
      if (
        existing &&
        !same &&
        (await db.meeting_agenda_item_occurrence.count({
          where: { item_id: existing.item_id },
        })) === 1
      ) {
        await db.meeting_agenda_item.update({
          where: { id: existing.item_id },
          data: {
            meeting_id: target.id,
            position: await insertionPosition(
              db,
              target.id,
              [occurrence.id],
              existing.item_id,
            ),
          },
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
          [occurrence.id],
          undefined,
          existing?.item,
        ));
      if (existing && same)
        await db.meeting_agenda_item.update({
          where: { id: same.id },
          data: {
            ...mergedAssignment(same, existing.item),
            instructions: mergedInstructions(same, existing.item, [
              template.instructions,
            ]),
          },
        });
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
