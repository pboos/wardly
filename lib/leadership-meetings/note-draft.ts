export type NoteDraft = {
  value: string;
  saved: string;
  received: string;
};

export function receiveNoteDraft(draft: NoteDraft, received: string): NoteDraft {
  if (draft.received === received) return draft;
  return draft.value === draft.saved
    ? { value: received, saved: received, received }
    : { ...draft, received };
}

export function acknowledgeNoteDraft(draft: NoteDraft, submitted: string): NoteDraft {
  const saved = submitted.trim();
  return {
    ...draft,
    value: draft.value === submitted ? saved : draft.value,
    saved,
  };
}
