"use client";

import { WardTimeZoneField } from "@/components/ward-time-zone-field";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function MeetingFields({ timeZones }: { timeZones: string[] }) {
  return (
    <>
      <WardTimeZoneField timeZones={timeZones} />
      <Field>
        <FieldLabel htmlFor="sacramentStartTime">
          Sacrament meeting starts
        </FieldLabel>
        <Input
          id="sacramentStartTime"
          name="sacramentStartTime"
          type="time"
          step={60}
          required
        />
        <FieldDescription>
          Local ward time. Assigned task reminders are emailed every Sunday one
          hour before.
        </FieldDescription>
      </Field>
    </>
  );
}
