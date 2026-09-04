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
import type { SundayMeetingItem } from "@/lib/sunday-meetings/types";
import { carrySundayAgendaItemForward } from "./actions";

/**
 * Small dialogs shared by the leading view's agenda rows: the carry-forward
 * confirmation and the single-line/multi-line item text editor.
 */

export function ItemContentDialog({
  label,
  triggerLabel,
  initialValue,
  onSave,
}: {
  /** Field label of the text (saved as the item content). */
  label: string;
  triggerLabel: string;
  initialValue: string;
  onSave: (value: string | null) => Promise<void>;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(initialValue);

  function save() {
    startTransition(async () => {
      try {
        await onSave(value.trim() || null);
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not update agenda item.",
        );
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CarryForwardButton({ item }: { item: SundayMeetingItem }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function move() {
    startTransition(async () => {
      try {
        const result = await carrySundayAgendaItemForward(item.id);
        setOpen(false);
        toast.success(`Moved to ${result.destinationDate}.`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not carry item forward.",
        );
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Carry forward
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carry this item forward?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The item, its linked task, and its people will move to the next eligible local Sunday meeting.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={move}>Move item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
