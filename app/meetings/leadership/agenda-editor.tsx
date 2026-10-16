"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addDays,
  assignMeeting,
  datesBetween,
  parseRule,
} from "@/lib/leadership-meetings/calendar";
import type { AgendaInput } from "@/lib/leadership-meetings/types";
import type { LeadershipData } from "@/lib/leadership-meetings/loaders";
import { ChoiceField } from "./choice-field";
import { RecurrenceFields } from "./recurrence-fields";
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
  let preview: { due: string; assigned?: string }[] = [];
  try {
    const rule = parseRule(draft.recurrence);
    const dates =
      rule.kind === "every_meeting"
        ? data.meetings
            .filter((m) => m.date >= draft.anchorDate && m.status === "planned")
            .map((m) => m.date)
        : datesBetween(
            rule,
            draft.anchorDate,
            draft.anchorDate,
            addDays(draft.anchorDate, 3 * 366),
          );
    preview = dates.slice(0, 3).map((due) => ({
      due,
      assigned: assignMeeting(
        due,
        data.meetings.map((m) =>
          m.date < data.today && m.status === "planned"
            ? { ...m, status: "past" }
            : m,
        ),
      )?.date,
    }));
  } catch {
    /* Incomplete date/number drafts have no preview. */
  }
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
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="agenda-title">Topic or question</FieldLabel>
              <Input
                id="agenda-title"
                autoFocus
                required
                maxLength={200}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="agenda-minutes">Planned minutes</FieldLabel>
              <Input
                id="agenda-minutes"
                type="number"
                required
                min={1}
                max={240}
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    durationMinutes: Number(e.target.value),
                  })
                }
              />
            </Field>
            {editing && (
              <ChoiceField
                id="agenda-scope"
                label="Apply changes to"
                value={scope}
                onChange={(v) => setScope(v === "future" ? "future" : "this")}
                options={[
                  { value: "this", label: "This meeting only" },
                  { value: "future", label: "This and future meetings" },
                ]}
              />
            )}
            {(!editing || scope === "future") && (
              <>
                <Field>
                  <FieldLabel htmlFor="agenda-anchor">
                    First due date / recurrence starts
                  </FieldLabel>
                  <Input
                    id="agenda-anchor"
                    type="date"
                    required
                    value={draft.anchorDate}
                    onChange={(e) =>
                      setDraft({ ...draft, anchorDate: e.target.value })
                    }
                  />
                </Field>
                <RecurrenceFields
                  value={draft.recurrence}
                  onChange={(recurrence) => setDraft({ ...draft, recurrence })}
                />
                <div className="text-sm text-muted-foreground">
                  <p>
                    Due items go to the last scheduled meeting on or before
                    their due date. Missed items go to the next available
                    meeting.
                  </p>
                  <ul className="mt-2 list-disc pl-5">
                    {preview.map((p) => (
                      <li key={p.due}>
                        Due {p.due} ·{" "}
                        {p.assigned
                          ? `meeting ${p.assigned}`
                          : "meeting assigned when scheduled"}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save item"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
