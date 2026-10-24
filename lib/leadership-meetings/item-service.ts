import { topicId } from "./topics";
import { updateDefaultAssignment, wardAssignee } from "./assignment";
import { SUGGESTIONS, canonicalSuggestionKey } from "./suggestions";
import { suggestionState } from "./suggestion-state";
import { localToday } from "./calendar";
import { nextTemplatePosition } from "./ordering";
import { randomUUID } from "node:crypto";
import { integer, dateString, parseRule, text } from "./calendar";
import {
  createAppearance,
  itemForWard,
  meetingForWard,
  mergeAppearance,
  reconcile,
  type Db,
} from "./store";
import {
  MAX_AGENDA_MINUTES,
  MAX_INSTRUCTIONS_LENGTH,
  type AgendaInput,
} from "./types";
export function parseAgenda(value: AgendaInput): AgendaInput {
  if (
    value.instructions !== undefined &&
    (typeof value.instructions !== "string" ||
      value.instructions.length > MAX_INSTRUCTIONS_LENGTH)
  )
    throw new Error(
      `Instructions must be at most ${MAX_INSTRUCTIONS_LENGTH} characters.`,
    );
  return {
    ...(value.instructions !== undefined
      ? { instructions: value.instructions }
      : {}),
    defaultAssignedUserId: value.defaultAssignedUserId,
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
  if (input.defaultAssignedUserId !== undefined)
    input.defaultAssignedUserId = await wardAssignee(
      db,
      wardId,
      input.defaultAssignedUserId,
    );
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
    const key = canonicalSuggestionKey(input.suggestionKey);
    const suggestion = SUGGESTIONS.find((s) => s.key === key);
    if (
      !suggestion?.repeatable &&
      (await suggestionState(db, meeting.series_id, meeting.id)).some(
        (s) => s.key === key,
      )
    )
      throw new Error(
        "This suggestion is already scheduled. Restore its removed item from Suggested items, or edit the existing agenda item to change its recurrence.",
      );
  }
  const topic = await db.meeting_agenda_topic.create({
    data: { series_id: meeting.series_id },
  });
  await db.meeting_agenda_template.create({
    data: {
      id,
      topic_id: topic.id,
      position: await nextTemplatePosition(db, meeting.series_id),
      series_id: meeting.series_id,
      title: input.title,
      instructions: input.instructions ?? "",
      duration_minutes: input.durationMinutes,
      recurrence: JSON.stringify(input.recurrence),
      anchor_date: input.anchorDate,
      suggestion_key: input.suggestionKey,
      default_assigned_user_id: input.defaultAssignedUserId,
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
export async function stopRepeating(
  db: Db,
  wardId: string,
  itemId: string,
  preserveAssignments = false,
) {
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
    if (preserveAssignments && row.assignment_overridden) continue;
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
  const template =
    item.occurrences.find((o) => !o.occurrence.template.archived)?.occurrence
      .template ?? item.occurrences[0]?.occurrence.template;
  const defaultUserId =
    input.defaultAssignedUserId === undefined
      ? (template?.default_assigned_user_id ?? null)
      : await wardAssignee(db, wardId, input.defaultAssignedUserId);
  if (
    scope === "future" &&
    template &&
    input.title === item.title &&
    input.title === template.title &&
    (input.instructions ?? item.instructions) === item.instructions &&
    (input.instructions ?? item.instructions) === template.instructions &&
    input.durationMinutes === item.duration_minutes &&
    input.durationMinutes === template.duration_minutes &&
    input.anchorDate === template.anchor_date &&
    JSON.stringify(input.recurrence) === template.recurrence
  ) {
    const series = await db.leadership_meeting_series.findUniqueOrThrow({
      where: { id: item.meeting.series_id },
    });
    const today = localToday(series.time_zone);
    await updateDefaultAssignment(
      db,
      [template.id],
      defaultUserId,
      item.meeting.date > today ? item.meeting.date : today,
    );
    return;
  }
  await db.meeting_agenda_item.update({
    where: { id: itemId },
    data: {
      title: input.title,
      instructions: input.instructions ?? item.instructions,
      duration_minutes: input.durationMinutes,
      ...(scope === "future" &&
      !item.assignment_overridden &&
      !item.predecessor_id &&
      item.meeting.status === "planned"
        ? { assigned_user_id: defaultUserId }
        : {}),
      updated_at: new Date(),
    },
  });
  if (scope === "future") {
    const templateIds = item.occurrences.map((o) => o.occurrence.template_id);
    const overrides = await db.meeting_agenda_item.findMany({
      where: {
        outcome: "pending",
        assignment_overridden: true,
        predecessor_id: null,
        meeting: {
          series_id: item.meeting.series_id,
          date: { gt: item.meeting.date },
          status: "planned",
        },
        occurrences: {
          some: { occurrence: { template_id: { in: templateIds } } },
        },
      },
      include: { occurrences: { include: { occurrence: true } } },
    });
    await stopRepeating(db, wardId, itemId, true);
    const replacement = await db.meeting_agenda_template.create({
      data: {
        id: randomUUID(),
        topic_id: topicId(item),
        position:
          item.occurrences.find((o) => !o.occurrence.template.archived)
            ?.occurrence.template.position ??
          item.occurrences[0]?.occurrence.template.position ??
          (await nextTemplatePosition(db, item.meeting.series_id)),
        series_id: item.meeting.series_id,
        title: input.title,
        instructions: input.instructions ?? item.instructions,
        default_assigned_user_id: defaultUserId,
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
    for (const override of overrides) {
      const generated = await db.meeting_agenda_item.findMany({
        where: {
          meeting_id: override.meeting_id,
          id: { not: override.id },
          outcome: "pending",
          occurrences: {
            some: { occurrence: { template_id: replacement.id } },
          },
        },
      });
      for (const row of generated)
        await mergeAppearance(db, override.id, row.id);
      if (!generated.length)
        await db.meeting_agenda_occurrence.create({
          data: {
            template_id: replacement.id,
            occurrence_key: `retained:${override.id}`,
            due_date:
              override.occurrences[0]?.occurrence.due_date ?? input.anchorDate,
            appearances: { create: { item_id: override.id } },
          },
        });
      await db.meeting_agenda_item.update({
        where: { id: override.id },
        data: {
          title: input.title,
          instructions: input.instructions ?? item.instructions,
          duration_minutes: input.durationMinutes,
        },
      });
    }
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

export { recordOutcome } from "./outcome-service";
