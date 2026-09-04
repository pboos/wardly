"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
  SundayItemMetadata,
  SundayMeetingItem,
} from "@/lib/sunday-meetings/types";

/**
 * What a hymn/musical-number slot cell saves: a hymn number in metadata, or
 * a free-text musical number in content. Empty values clear the slot item
 * (the auto-delete rule removes the row).
 */
export type SundayHymnSlotInput = {
  type: "hymn" | "musical_number";
  metadata: SundayItemMetadata | null;
  content: string | null;
};

function hymnSlotValue(item: SundayMeetingItem | null): string {
  if (!item) return "";
  if (item.type === "musical_number") return item.content ?? "";
  return item.metadata?.hymnNumber?.toString() ?? "";
}

export function SundayInlineHymnEditor({
  item,
  allowMusicalNumber,
  onSave,
}: {
  /** The slot item, or null while the virtual slot is still empty. */
  item: SundayMeetingItem | null;
  allowMusicalNumber: boolean;
  onSave: (input: SundayHymnSlotInput) => Promise<unknown>;
}) {
  const router = useRouter();
  const inputId = useId();
  const [draft, setDraft] = useState(hymnSlotValue(item));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function restoreServerValue() {
    setDraft(hymnSlotValue(item));
    setError(null);
  }

  function save() {
    if (isPending) return;
    const trimmed = draft.trim();
    // An empty virtual slot has nothing to clear — skip the server round trip.
    if (!trimmed && !item) return;
    let payload: SundayHymnSlotInput;
    const isNumeric = /^[-+]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[-+]?\d+)?$/i.test(trimmed)
      || /^[-+]?Infinity$/i.test(trimmed);

    if (!trimmed) {
      payload = { type: "hymn", metadata: null, content: null };
    } else if (!isNumeric && allowMusicalNumber) {
      payload = { type: "musical_number", metadata: null, content: trimmed };
    } else if (/^\d+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed)) && Number(trimmed) > 0) {
      payload = { type: "hymn", metadata: { hymnNumber: Number(trimmed) }, content: null };
    } else {
      setError("Enter a positive whole hymn number or leave the field blank.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await onSave(payload);
        router.refresh();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Could not update hymn.";
        setError(message);
        toast.error(message, { action: { label: "Reload", onClick: () => router.refresh() } });
      }
    });
  }

  const errorId = `${inputId}-error`;
  return (
    <Field className="min-w-32 gap-1">
      <FieldLabel className="sr-only" htmlFor={inputId}>Hymn number or musical number</FieldLabel>
      <Input
        id={inputId}
        value={draft}
        disabled={isPending}
        aria-label={allowMusicalNumber ? "Hymn number or musical number" : "Hymn number"}
        aria-invalid={Boolean(error)}
        aria-errormessage={error ? errorId : undefined}
        placeholder={allowMusicalNumber ? "Hymn or musical number" : "Hymn number"}
        onChange={(event) => { setDraft(event.target.value); setError(null); }}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); save(); }
          if (event.key === "Escape") { event.preventDefault(); restoreServerValue(); }
        }}
      />
      {error && <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>}
    </Field>
  );
}
