import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { localToday, scheduleThrough } from "./calendar";
import { recurrenceDues, targetForDue } from "./reconciliation-rules";
import { nextTemplatePosition } from "./ordering";
import { ensureSchedule, reconcile, type Db } from "./store";
import {
  suggestionAnchor,
  suggestionInstructions,
  type Suggestion,
} from "./suggestions";

export async function createSuggestedAgenda(
  db: Db,
  meeting: {
    id: string;
    series_id: string;
    date: string;
    series: { time_zone: string };
  },
  suggestions: Suggestion[],
) {
  if (!suggestions.length) return;
  const today = localToday(meeting.series.time_zone);
  const through = scheduleThrough(today);
  await ensureSchedule(db, meeting.series_id, through);
  const position = await nextTemplatePosition(db, meeting.series_id);
  const templates = suggestions.map((suggestion, index) => ({
    id: randomUUID(),
    position: position + index,
    series_id: meeting.series_id,
    title: suggestion.title,
    instructions: suggestionInstructions(suggestion),
    duration_minutes: suggestion.duration,
    recurrence: JSON.stringify(suggestion.recurrence),
    anchor_date: suggestionAnchor(suggestion.key, meeting.date),
    suggestion_key: suggestion.key,
    after_date: null,
    after_meeting_date: null,
  }));
  const meetings = await db.leadership_meeting.findMany({
    where: { series_id: meeting.series_id },
    orderBy: { date: "asc" },
    include: {
      items: { select: { position: true, outcome: true, decision: true } },
    },
  });
  const held = new Set(
    meetings.filter((row) => row.items.some((item) =>
      !["pending", "removed"].includes(item.outcome) || item.decision !== "",
    )).map((row) => row.id),
  );
  const selectedIsHeld = held.has(meeting.id) ||
    meetings.find((row) => row.id === meeting.id)?.status === "active";
  const positions = new Map(
    meetings.map((row) => [
      row.id,
      Math.max(-1, ...row.items.map((item) => item.position)) + 1,
    ]),
  );
  const occurrences: Prisma.meeting_agenda_occurrenceCreateManyInput[] = [];
  const items: Prisma.meeting_agenda_itemCreateManyInput[] = [];
  const links: Prisma.meeting_agenda_item_occurrenceCreateManyInput[] = [];
  for (const [index, template] of templates.entries()) {
    const rule = suggestions[index].recurrence;
    const dues = new Map<string, { date: string; targetId: string | undefined }>();
    if (rule.kind === "once" || rule.kind === "every_meeting")
      dues.set(rule.kind === "every_meeting" ? meeting.id : template.anchor_date, {
        date: rule.kind === "every_meeting" ? meeting.date : template.anchor_date,
        targetId: meeting.id,
      });
    for (const due of recurrenceDues({ rule, template, meetings, today, through })) {
      const seed = dues.get(due.key);
      dues.set(due.key, {
        date: due.date,
        targetId: seed && selectedIsHeld
          ? seed.targetId
          : targetForDue({ due, template, meetings, today, held })?.id ??
            seed?.targetId,
      });
    }
    const appearances = new Map<string, string>();
    for (const [key, due] of dues) {
      const occurrenceId = randomUUID();
      occurrences.push({
        id: occurrenceId,
        template_id: template.id,
        occurrence_key: key,
        due_date: due.date,
      });
      if (!due.targetId) continue;
      let itemId = appearances.get(due.targetId);
      if (!itemId) {
        itemId = randomUUID();
        appearances.set(due.targetId, itemId);
        const position = positions.get(due.targetId) ?? 0;
        positions.set(due.targetId, position + 1);
        items.push({
          id: itemId,
          meeting_id: due.targetId,
          position,
          title: template.title,
          instructions: template.instructions,
          duration_minutes: template.duration_minutes,
        });
      }
      links.push({ item_id: itemId, occurrence_id: occurrenceId });
    }
  }
  await db.meeting_agenda_template.createMany({ data: templates });
  if (occurrences.length)
    await db.meeting_agenda_occurrence.createMany({ data: occurrences });
  if (items.length) await db.meeting_agenda_item.createMany({ data: items });
  if (links.length)
    await db.meeting_agenda_item_occurrence.createMany({ data: links });
  await reconcile(db, meeting.series_id);
}
