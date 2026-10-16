"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldSet } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { AgendaInput } from "@/lib/leadership-meetings/types";
import type { LeadershipData } from "@/lib/leadership-meetings/loaders";
import { AgendaSetupFields } from "./agenda-setup-fields";
export function AgendaEditor({
  initial,
  editing,
  data,
  pending,
  onClose,
  onSave,
}: {
  initial: AgendaInput;
  editing: boolean;
  data: LeadershipData;
  pending: boolean;
  onClose: () => void;
  onSave: (input: AgendaInput, scope: "this" | "future") => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [scope, setScope] = useState<"this" | "future">("this");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit agenda item" : "Add agenda item"}
          </DialogTitle>
          <DialogDescription>
            Keep discussion focused on a decision or next action.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(draft, scope);
          }}
        >
          <FieldSet disabled={pending}>
            <AgendaSetupFields
              draft={draft}
              setDraft={setDraft}
              scope={scope}
              setScope={setScope}
              editing={editing}
              data={data}
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save item"}
            </Button>
          </FieldSet>
        </form>
      </DialogContent>
    </Dialog>
  );
}
