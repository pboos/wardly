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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Dialog that edits one single-line or multi-line text value behind a ghost
 * trigger button (e.g. the meeting information cell of the schedule rows).
 */
export function TextDialog({
  title,
  triggerLabel,
  initialValue,
  multiline = false,
  onSave,
}: {
  title: string;
  triggerLabel: string;
  initialValue: string;
  multiline?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const router = useRouter();
  const id = useId();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);

  function save() {
    startTransition(async () => {
      try {
        await onSave(value.trim());
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save text.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="max-w-48 truncate" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={id}>{title}</FieldLabel>
              {multiline ? (
                <Textarea id={id} value={value} onChange={(event) => setValue(event.target.value)} rows={5} />
              ) : (
                <Input id={id} value={value} onChange={(event) => setValue(event.target.value)} />
              )}
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
