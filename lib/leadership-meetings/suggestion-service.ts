import { randomUUID } from "node:crypto";
import { addAgenda, requestUuid } from "./item-service";
import { meetingForWard, type Db } from "./store";
import { restoreAgenda } from "./removal";
import { suggestionState } from "./suggestion-state";
import { orderSuggestions } from "./suggestion-order";
import {
  canonicalSuggestionKey,
  suggestionAnchor,
  suggestionInstructions,
  suggestionsForKind,
} from "./suggestions";

export async function addSuggestions(
  db: Db,
  wardId: string,
  meetingId: string,
  requestId: string,
  selection: { kind: "one"; key: string } | { kind: "all" },
) {
  const meeting = await meetingForWard(db, wardId, meetingId, false);
  const id = requestUuid(requestId);
  const fingerprint = JSON.stringify(selection);
  const receipt = await db.meeting_suggestion_receipt.findUnique({
    where: { id },
  });
  if (receipt) {
    if (
      receipt.meeting_id !== meeting.id ||
      receipt.fingerprint !== fingerprint
    )
      throw new Error(
        "Invalid request identifier: this identifier was used for a different suggestion command.",
      );
    return;
  }
  await meetingForWard(db, wardId, meeting.id);
  const kind = meeting.series.kind;
  if (kind !== "bishopric" && kind !== "ward_council")
    throw new Error("Unknown meeting type.");
  const catalog = suggestionsForKind(kind);
  const suggestions =
    selection.kind === "all"
      ? catalog
      : catalog.filter((s) => s.key === canonicalSuggestionKey(selection.key));
  if (!suggestions.length)
    throw new Error("Suggestion not available for this meeting.");
  await db.meeting_suggestion_receipt.create({
    data: { id, meeting_id: meeting.id, fingerprint },
  });
  const active = await suggestionState(db, meeting.series_id, meeting.id);
  for (const suggestion of suggestions) {
    const state = active.filter((s) => s.key === suggestion.key);
    const removed = [
      ...new Set(
        state.flatMap((s) => (s.restoreItemId ? [s.restoreItemId] : [])),
      ),
    ];
    for (const itemId of selection.kind === "all"
      ? removed
      : removed.slice(0, 1))
      await restoreAgenda(db, wardId, itemId);
    if (selection.kind === "one" && removed.length) continue;
    const recurring = new Set(
      state
        .filter((s) => s.recurrence.kind !== "once")
        .map((s) => s.templateId),
    );
    let count = state.length ? 0 : 1;
    if (suggestion.repeatable)
      count = selection.kind === "one" ? 1 : Math.max(0, 2 - recurring.size);
    for (let index = 0; index < count; index++)
      await addAgenda(
        db,
        wardId,
        meeting.id,
        {
          title: suggestion.title,
          instructions: suggestionInstructions(suggestion),
          durationMinutes: suggestion.duration,
          anchorDate: suggestionAnchor(suggestion.key, meeting.date),
          recurrence: suggestion.recurrence,
          suggestionKey: suggestion.key,
        },
        randomUUID(),
      );
  }
  if (selection.kind === "all") await orderSuggestions(db, meeting);
}
