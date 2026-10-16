import { nextTemplatePosition } from "./ordering";
import { randomUUID } from "node:crypto";
import { integer, dateString, parseRule, text } from "./calendar";
import {
  createAppearance,
  itemForWard,
  meetingForWard,
  nextMeeting,
  reconcile,
  type Db,
} from "./store";
import { MAX_AGENDA_MINUTES, type AgendaInput, type ItemOutcome } from "./types";
export function parseAgenda(value: AgendaInput): AgendaInput {
  return {
    title: text(value.title),
    durationMinutes: integer(value.durationMinutes, 1, MAX_AGENDA_MINUTES),
    anchorDate: dateString(value.anchorDate),
    recurrence: parseRule(value.recurrence),
    ...(value.suggestionKey
      ? { suggestionKey: text(value.suggestionKey) }
      : {}),
  };
}
export async function addAgenda(
  db: Db,
  wardId: string,
  meetingId: string,
  raw: AgendaInput,
  requestId: string,
) {
  const meeting = await meetingForWard(db, wardId, meetingId);
  const input = parseAgenda(raw);
  const id = requestUuid(requestId);
  const existing = await db.meeting_agenda_template.findUnique({
    where: { id },
  });
  if (existing) {
    if (existing.series_id !== meeting.series_id)
      throw new Error("Invalid request identifier.");
    return;
  }
  if (input.suggestionKey) {
    const templates = await db.meeting_agenda_template.findMany({
      where: {
        series_id: meeting.series_id,
        suggestion_key: input.suggestionKey,
        archived: false,
      },
      include: {
        occurrences: {
          where: {
            OR: [
              { status: "pending" },
              {
                status: "removed",
                appearances: {
                  some: {
                    item: {
                      meeting: { status: { in: ["planned", "active"] } },
                    },
                  },
                },
              },
            ],
          },
          select: { status: true },
        },
      },
    });
    const scheduled = templates.some(
      (template) =>
        parseRule(JSON.parse(template.recurrence)).kind !== "once" ||
        template.occurrences.some(
          (o) => o.status === "pending" || o.status === "removed",
        ),
    );
    if (scheduled)
      throw new Error(
        "This suggestion is already scheduled. Restore its removed item from Suggested items, or edit the existing agenda item to change its recurrence.",
      );
  }
  await db.meeting_agenda_template.create({
    data: {
      id,
      position: await nextTemplatePosition(db, meeting.series_id),
      series_id: meeting.series_id,
      title: input.title,
      duration_minutes: input.durationMinutes,
      recurrence: JSON.stringify(input.recurrence),
      anchor_date: input.anchorDate,
      suggestion_key: input.suggestionKey,
    },
  });
  const dueDate =
    input.recurrence.kind === "once" ? input.anchorDate : meeting.date;
  if (
    input.recurrence.kind === "once" ||
    input.recurrence.kind === "every_meeting"
  ) {
    const occurrence = await db.meeting_agenda_occurrence.create({
      data: {
        template_id: id,
        due_date: dueDate,
        occurrence_key:
          input.recurrence.kind === "every_meeting" ? meeting.id : dueDate,
      },
    });
    await createAppearance(db, meetingId, input.title, input.durationMinutes, [
      occurrence.id,
    ]);
  }
  await reconcile(db, meeting.series_id);
}
export async function recordOutcome(
  db: Db,
  wardId: string,
  itemId: string,
  outcome: ItemOutcome,
  decision: string,
  expectedDecision?: string,
) {
  if (!["done", "continued", "deferred", "skipped"].includes(outcome))
    throw new Error("Invalid agenda outcome.");
  if (typeof decision !== "string" || decision.length > 4000)
    throw new Error("Decision must be at most 4000 characters.");
  const item = await itemForWard(db, wardId, itemId);
  if (item.outcome === outcome && item.decision === decision.trim()) return;
  if (expectedDecision !== undefined && item.decision !== expectedDecision)
    throw new Error(
      "Discussion notes changed in another window. Copy your draft, close and reopen this item to review the latest notes.",
    );
  if (item.outcome !== "pending") {
    throw new Error("This item has already been resolved. Refresh the agenda.");
  }
  if (outcome === "continued" || outcome === "deferred") {
    const next = await nextMeeting(
      db,
      item.meeting.series_id,
      item.meeting.date,
    );
    const successor = await createAppearance(
      db,
      next.id,
      item.title,
      item.duration_minutes,
      item.occurrences.map((o) => o.occurrence_id),
      item.id,
    );
    await db.meeting_agenda_item_task.createMany({
      data: (
        await db.meeting_agenda_item_task.findMany({
          where: { item_id: item.id },
        })
      ).map((t) => ({ item_id: successor.id, task_id: t.task_id })),
    });
    const templateIds = item.occurrences.map((o) => o.occurrence.template_id);
    const duplicates = await db.meeting_agenda_item.findMany({
      where: {
        meeting_id: next.id,
        id: { not: successor.id },
        outcome: "pending",
        predecessor_id: null,
        occurrences: {
          some: { occurrence: { template_id: { in: templateIds } } },
        },
      },
      include: { occurrences: true, tasks: true },
    });
    const inheritedPosition = duplicates.length
      ? Math.min(...duplicates.map((row) => row.position))
      : undefined;
    for (const duplicate of duplicates) {
      for (const o of duplicate.occurrences)
        await db.meeting_agenda_item_occurrence.upsert({
          where: {
            item_id_occurrence_id: {
              item_id: successor.id,
              occurrence_id: o.occurrence_id,
            },
          },
          create: { item_id: successor.id, occurrence_id: o.occurrence_id },
          update: {},
        });
      for (const t of duplicate.tasks)
        await db.meeting_agenda_item_task.upsert({
          where: {
            item_id_task_id: { item_id: successor.id, task_id: t.task_id },
          },
          create: { item_id: successor.id, task_id: t.task_id },
          update: {},
        });
      if (duplicate.decision)
        await db.meeting_agenda_item.update({
          where: { id: successor.id },
          data: { decision: duplicate.decision },
        });
      await db.meeting_agenda_item.delete({ where: { id: duplicate.id } });
    }
    if (inheritedPosition !== undefined)
      await db.meeting_agenda_item.update({
        where: { id: successor.id },
        data: { position: inheritedPosition },
      });
  } else {
    await db.meeting_agenda_occurrence.updateMany({
      where: { id: { in: item.occurrences.map((o) => o.occurrence_id) } },
      data: { status: outcome, updated_at: new Date() },
    });
  }
  await db.meeting_agenda_item.update({
    where: { id: itemId },
    data: { outcome, decision: decision.trim(), updated_at: new Date() },
  });
}
export async function stopRepeating(db: Db, wardId: string, itemId: string) {
  const item = await itemForWard(db, wardId, itemId);
  const ids = item.occurrences.map((o) => o.occurrence.template_id);
  await db.meeting_agenda_template.updateMany({
    where: { id: { in: ids } },
    data: { archived: true, updated_at: new Date() },
  });
  const future = await db.meeting_agenda_item.findMany({
    where: {
      meeting: {
        series_id: item.meeting.series_id,
        date: { gt: item.meeting.date },
        status: "planned",
      },
      outcome: "pending",
      predecessor_id: null,
      occurrences: { some: { occurrence: { template_id: { in: ids } } } },
    },
    include: { occurrences: true },
  });
  for (const row of future) {
    await db.meeting_agenda_occurrence.updateMany({
      where: { id: { in: row.occurrences.map((o) => o.occurrence_id) } },
      data: { status: "skipped" },
    });
    await db.meeting_agenda_item.delete({ where: { id: row.id } });
  }
}
export async function editAgenda(
  db: Db,
  wardId: string,
  itemId: string,
  raw: AgendaInput,
  scope: "this" | "future",
) {
  const item = await itemForWard(db, wardId, itemId);
  if (item.outcome !== "pending")
    throw new Error("Only pending items can be edited.");
  const input = parseAgenda(raw);
  if (scope !== "this" && scope !== "future")
    throw new Error("Choose an edit scope.");
  await db.meeting_agenda_item.update({
    where: { id: itemId },
    data: {
      title: input.title,
      duration_minutes: input.durationMinutes,
      updated_at: new Date(),
    },
  });
  if (scope === "future") {
    await stopRepeating(db, wardId, itemId);
    const replacement = await db.meeting_agenda_template.create({
      data: {
        id: randomUUID(),
        position:
          item.occurrences.find((o) => !o.occurrence.template.archived)
            ?.occurrence.template.position ??
          item.occurrences[0]?.occurrence.template.position ??
          (await nextTemplatePosition(db, item.meeting.series_id)),
        series_id: item.meeting.series_id,
        title: input.title,
        duration_minutes: input.durationMinutes,
        recurrence: JSON.stringify(input.recurrence),
        anchor_date: input.anchorDate,
        after_date: [
          ...item.occurrences.map((o) => o.occurrence.due_date),
          item.meeting.date,
        ]
          .sort()
          .at(-1),
        after_meeting_date: item.meeting.date,
        suggestion_key: item.occurrences[0]?.occurrence.template.suggestion_key,
      },
    });
    await db.meeting_agenda_occurrence.create({
      data: {
        template_id: replacement.id,
        occurrence_key: `current:${item.id}`,
        due_date: replacement.after_date!,
        appearances: { create: { item_id: item.id } },
      },
    });
    await reconcile(db, item.meeting.series_id);
  }
}

export function requestUuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("Invalid request identifier.");
  return value;
}
