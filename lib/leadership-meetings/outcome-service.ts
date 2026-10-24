import { saveSharedNotes, topicId } from "./topics";
import { canMergeAssignments, mergedAssignment } from "./assignment";
import { canMergeInstructions, mergedInstructions } from "./instructions";
import { createAppearance, itemForWard, nextMeeting, type Db } from "./store";
import type { ItemOutcome, SharedNotesEdit } from "./types";
export async function recordOutcome(
  db: Db,
  wardId: string,
  itemId: string,
  outcome: ItemOutcome,
  decision: string,
  expectedDecision?: string,
  sharedNotes?: SharedNotesEdit,
) {
  if (!["done", "continued", "deferred", "skipped"].includes(outcome))
    throw new Error("Invalid agenda outcome.");
  if (typeof decision !== "string" || decision.length > 4000)
    throw new Error("Decision must be at most 4000 characters.");
  const item = await itemForWard(db, wardId, itemId);
  await saveSharedNotes(db, item, sharedNotes);
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
      item,
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
      include: {
        occurrences: {
          include: { occurrence: { include: { template: true } } },
        },
        tasks: true,
      },
    });
    const compatible = duplicates.filter(
      (duplicate) =>
        topicId(item) === topicId(duplicate) &&
        canMergeAssignments(item, duplicate) &&
        canMergeInstructions(
          item,
          duplicate,
          duplicate.occurrences.map((o) => o.occurrence.template.instructions),
        ),
    );
    const inheritedPosition = compatible.length
      ? Math.min(...compatible.map((row) => row.position))
      : undefined;
    for (const duplicate of compatible) {
      const latest = await db.meeting_agenda_item.findUniqueOrThrow({
        where: { id: successor.id },
      });
      const defaults = duplicate.occurrences.map(
        (o) => o.occurrence.template.instructions,
      );
      if (
        !canMergeAssignments(latest, duplicate) ||
        !canMergeInstructions(latest, duplicate, defaults)
      )
        continue;
      await db.meeting_agenda_item.update({
        where: { id: successor.id },
        data: {
          ...mergedAssignment(latest, duplicate),
          instructions: mergedInstructions(latest, duplicate, defaults),
        },
      });
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
