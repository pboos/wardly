"use client";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  addDays,
  assignMeeting,
  datesBetween,
  parseRule,
} from "@/lib/leadership-meetings/calendar";
import { MAX_AGENDA_MINUTES, type AgendaInput } from "@/lib/leadership-meetings/types";
import type { LeadershipData } from "@/lib/leadership-meetings/loaders";
import { ChoiceField } from "./choice-field";
import { RecurrenceFields } from "./recurrence-fields";
export function AgendaSetupFields({
  draft,
  setDraft,
  scope,
  setScope,
  editing,
  data,
}: {
  draft: AgendaInput;
  setDraft: (input: AgendaInput) => void;
  scope: "this" | "future";
  setScope: (scope: "this" | "future") => void;
  editing: boolean;
  data: LeadershipData;
}) {
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
    <>
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
          max={MAX_AGENDA_MINUTES}
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
          label="Edit scope"
          value={scope}
          onChange={(v) => setScope(v === "future" ? "future" : "this")}
          options={[
            { value: "this", label: "Edit this occurrence" },
            { value: "future", label: "Edit recurring series" },
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
              Due items go to the last scheduled meeting on or before their due
              date. Missed items go to the next available meeting.
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
    </>
  );
}
