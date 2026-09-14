"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import type {
  SundayItemMetadata,
  SundayMeetingItem,
} from "@/lib/sunday-meetings/types";
import { useSundayHymns } from "./sunday-hymn-provider";
import { SundayHymnPickerDialog } from "./sunday-hymn-picker-dialog";

export type SundayHymnSlotInput = {
  type: "hymn" | "musical_number";
  metadata: SundayItemMetadata | null;
  content: string | null;
  person: null;
};

export function SundayHymnPicker({
  item,
  allowMusicalNumber,
  onSave,
}: {
  item: Pick<
    SundayMeetingItem,
    "type" | "metadata" | "content" | "personNameResolved"
  > | null;
  allowMusicalNumber: boolean;
  onSave: (input: SundayHymnSlotInput) => Promise<unknown>;
}) {
  const router = useRouter();
  const { hymns } = useSundayHymns();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const number = item?.metadata?.hymnNumber;
  const title = hymns.find((hymn) => hymn.number === number)?.title;
  const label =
    item?.type === "musical_number"
      ? item.content || "Musical number"
      : number
        ? `${number}${title ? ` · ${title}` : ""}`
        : "+ Add hymn";
  function save(input: SundayHymnSlotInput) {
    if (saving.current) return;
    saving.current = true;
    setError(null);
    startTransition(async () => {
      try {
        await onSave(input);
        setOpen(false);
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not update hymn.",
        );
      } finally {
        saving.current = false;
      }
    });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving.current) {
          setOpen(value);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto max-w-full whitespace-normal break-words text-left"
          disabled={pending}
          aria-label={`Select hymn: ${label}`}
        >
          {label}
        </Button>
      </DialogTrigger>
      {open && (
        <SundayHymnPickerDialog
          initialNumber={number}
          initialText={
            item?.type === "musical_number" ? (item.content ?? "") : undefined
          }
          allowMusicalNumber={allowMusicalNumber}
          canClear={Boolean(
            item && (number || item.content || item.personNameResolved),
          )}
          pending={pending}
          error={error}
          onSave={save}
          onCancel={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}
