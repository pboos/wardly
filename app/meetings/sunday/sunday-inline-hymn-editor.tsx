"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { UpdateAgendaItemInput } from "@/lib/sunday-meetings/service";
import type { SundayMeetingItem } from "@/lib/sunday-meetings/types";

export function SundayInlineHymnEditor({
  item,
  allowMusicalNumber,
  onSave,
}: {
  item: SundayMeetingItem;
  allowMusicalNumber: boolean;
  onSave: (input: UpdateAgendaItemInput) => Promise<unknown>;
}) {
  const router = useRouter();
  const inputId = useId();
  const [draft, setDraft] = useState(
    item.type === "musical_number" ? item.content ?? "" : item.hymnNumber?.toString() ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function restoreServerValue() {
    setDraft(item.type === "musical_number" ? item.content ?? "" : item.hymnNumber?.toString() ?? "");
    setError(null);
  }

  function save() {
    if (isPending) return;
    const trimmed = draft.trim();
    let payload: UpdateAgendaItemInput;
    const isNumeric = /^[-+]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[-+]?\d+)?$/i.test(trimmed)
      || /^[-+]?Infinity$/i.test(trimmed);

    if (!trimmed) {
      payload = { type: "hymn", hymnNumber: null, content: null };
    } else if (!isNumeric && allowMusicalNumber) {
      payload = { type: "musical_number", hymnNumber: null, content: trimmed };
    } else if (/^\d+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed)) && Number(trimmed) > 0) {
      payload = { type: "hymn", hymnNumber: Number(trimmed), content: null };
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
