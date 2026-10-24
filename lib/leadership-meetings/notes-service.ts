import { itemForWard, type Db } from "./store";
import { saveSharedNotes } from "./topics";
import type { SharedNotesEdit } from "./types";

export async function saveDiscussionNotes(
  db: Db,
  wardId: string,
  input: { itemId: string; decision: string; expectedDecision: string; sharedNotes?: SharedNotesEdit },
) {
  if (typeof input.decision !== "string" || input.decision.length > 4000 ||
      typeof input.expectedDecision !== "string")
    throw new Error("Discussion notes must be at most 4000 characters.");
  const item = await itemForWard(db, wardId, input.itemId, false);
  await saveSharedNotes(db, item, input.sharedNotes);
  if (item.decision === input.decision.trim()) return;
  if (item.decision !== input.expectedDecision)
    throw new Error("Discussion notes changed in another window. Copy your draft, discard changes and reopen this item to review the latest notes.");
  await db.meeting_agenda_item.update({
    where: { id: item.id },
    data: { decision: input.decision.trim(), updated_at: new Date() },
  });
}
