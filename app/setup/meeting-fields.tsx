"use client";

import { useSyncExternalStore, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => "";

export function MeetingFields({ timeZones }: { timeZones: string[] }) {
  const detected = useSyncExternalStore(subscribe, browserZone, serverZone);
  const [selected, setSelected] = useState<string | null>(null);
  const timeZone = selected ?? detected;
  const zones = [
    ...new Set([...timeZones, ...(detected ? [detected] : [])]),
  ].sort();
  return (
    <>
      <Field>
        <FieldLabel htmlFor="timeZone">Ward time zone</FieldLabel>
        <Combobox
          id="timeZone"
          items={zones.map((value) => ({ value, label: value }))}
          value={timeZone}
          onChange={setSelected}
          placeholder="Select time zone…"
          searchPlaceholder="Search time zones…"
        />
        <Input type="hidden" name="timeZone" value={timeZone} />
        <FieldDescription>
          Detected from your device. Choose the ward’s time zone if different.
        </FieldDescription>
      </Field>
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
