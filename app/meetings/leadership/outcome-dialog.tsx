"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { AgendaRow } from "@/lib/leadership-meetings/loaders";
import type { ItemOutcome } from "@/lib/leadership-meetings/types";
export const outcomeLabels: Record<ItemOutcome, string> = {
  done: "Done",
  continued: "Continue next meeting",
  deferred: "Move to next meeting",
  skipped: "Skip this occurrence",
};
export function OutcomeDialog({
  item,
  outcome,
  pending,
  onClose,
  onSave,
}: {
  item: AgendaRow;
  outcome: ItemOutcome;
  pending: boolean;
  onClose: () => void;
  onSave: (decision: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState(item.decision);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{outcomeLabels[outcome]}</DialogTitle>
          <DialogDescription>
            {item.title}.{" "}
            {outcome === "continued"
              ? "Record what was discussed. The next meeting keeps a continuation."
              : outcome === "deferred"
                ? "Move this discussion without marking it complete."
                : "Follow-up tasks keep their own completion status."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(decision);
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="agenda-decision">
                Decision or next step (optional)
              </FieldLabel>
              <Textarea
                id="agenda-decision"
                maxLength={4000}
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Visible to all ward users. Keep confidential counseling details
                elsewhere.
              </p>
            </Field>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : outcomeLabels[outcome]}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
