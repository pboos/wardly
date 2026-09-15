"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function ItemContentDialog({
  label,
  triggerLabel,
  initialValue,
  onSave,
  inline = false,
}: {
  /** Field label of the text (saved as the item content). */
  label: string;
  triggerLabel: string;
  inline?: boolean;
  initialValue: string;
  onSave: (value: string | null) => Promise<void>;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialValue);

  function save() {
    startTransition(async () => {
      try {
        await onSave(value.trim() || null);
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not update agenda item.",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={inline ? "ghost" : "outline"}
        size="sm"
        className="h-auto min-h-8 max-w-full justify-start whitespace-pre-wrap break-words text-left"
        aria-label={`Edit ${label.toLowerCase()}: ${triggerLabel}`}
        onClick={() => {
          setValue(initialValue);
          setOpen(true);
        }}
      >
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              <Textarea
                id={id}
                rows={4}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
