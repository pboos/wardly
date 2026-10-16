"use client";
import { useId } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { CalendarRule } from "@/lib/leadership-meetings/calendar";
import { ChoiceField } from "./choice-field";
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
].map((label, i) => ({ value: String(i), label }));
export function RecurrenceFields({
  value,
  onChange,
  scheduleOnly = false,
}: {
  value: CalendarRule;
  onChange: (value: CalendarRule) => void;
  scheduleOnly?: boolean;
}) {
  const id = useId();
  const options = [
    { value: "once", label: "One-time" },
    { value: "every_meeting", label: "Every meeting" },
    { value: "weeks", label: "Every N weeks" },
    { value: "months", label: "Day of the month" },
    { value: "ordinal", label: "Weekday of the month" },
    { value: "annual", label: "Annually" },
  ].filter((o) => !scheduleOnly || ["weeks", "ordinal"].includes(o.value));
  function kindChanged(kind: string) {
    switch (kind) {
      case "once":
      case "every_meeting":
        onChange({ version: 1, kind });
        break;
      case "weeks":
        onChange({ version: 1, kind, interval: 1, weekday: 0 });
        break;
      case "months":
        onChange({ version: 1, kind, interval: 1, day: 15 });
        break;
      case "ordinal":
        onChange({ version: 1, kind, interval: 1, weekday: 0, ordinal: 1 });
        break;
      case "annual":
        onChange({ version: 1, kind, month: 11, day: 1 });
        break;
    }
  }
  return (
    <>
      <ChoiceField
        id={`${id}-kind`}
        label={scheduleOnly ? "Meeting pattern" : "Repeat"}
        value={value.kind}
        onChange={kindChanged}
        options={options}
      />
      {"interval" in value && (
        <Field>
          <FieldLabel htmlFor={`${id}-interval`}>
            Every how many {value.kind === "weeks" ? "weeks" : "months"}?
          </FieldLabel>
          <Input
            id={`${id}-interval`}
            type="number"
            min={1}
            max={value.kind === "weeks" ? 52 : 24}
            value={value.interval}
            onChange={(e) =>
              onChange({ ...value, interval: Number(e.target.value) })
            }
          />
        </Field>
      )}
      {"weekday" in value && (
        <ChoiceField
          id={`${id}-weekday`}
          label="Weekday"
          value={String(value.weekday)}
          onChange={(v) => onChange({ ...value, weekday: Number(v) })}
          options={weekdays}
        />
      )}
      {value.kind === "ordinal" && (
        <ChoiceField
          id={`${id}-ordinal`}
          label="Which week?"
          value={String(value.ordinal)}
          onChange={(v) => onChange({ ...value, ordinal: Number(v) })}
          options={(scheduleOnly ? [1, 2, 3, 4, -1] : [1, 2, 3, 4, 5, -1]).map(
            (n) => ({
              value: String(n),
              label: n === -1 ? "Last" : String(n),
            }),
          )}
        />
      )}
      {value.kind === "annual" && (
        <Field>
          <FieldLabel htmlFor={`${id}-month`}>Month (1–12)</FieldLabel>
          <Input
            id={`${id}-month`}
            type="number"
            min={1}
            max={12}
            value={value.month}
            onChange={(e) =>
              onChange({ ...value, month: Number(e.target.value) })
            }
          />
        </Field>
      )}
      {"day" in value && (
        <Field>
          <FieldLabel htmlFor={`${id}-day`}>Day of month</FieldLabel>
          <Input
            id={`${id}-day`}
            type="number"
            min={1}
            max={31}
            value={value.day}
            onChange={(e) =>
              onChange({ ...value, day: Number(e.target.value) })
            }
          />
          <p className="text-sm text-muted-foreground">
            Shorter months use their last day. February 29 uses February 28 in
            non-leap years.
          </p>
        </Field>
      )}
    </>
  );
}
