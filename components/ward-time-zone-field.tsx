"use client";

import { useState, useSyncExternalStore } from "react";
import { Combobox } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => "";

export function WardTimeZoneField({
  timeZones,
  defaultValue,
  disabled = false,
}: {
  timeZones: string[];
  defaultValue?: string;
  disabled?: boolean;
}) {
  const detected = useSyncExternalStore(subscribe, browserZone, serverZone);
  const [selected, setSelected] = useState<string | null>(null);
  const timeZone = selected ?? defaultValue ?? detected;
  const zones = [
    ...new Set([...timeZones, "UTC", timeZone].filter(Boolean)),
  ].sort();

  return (
    <Field data-disabled={disabled}>
      <FieldLabel htmlFor="timeZone">Ward time zone</FieldLabel>
      <Combobox
        id="timeZone"
        items={zones.map((value) => ({ value, label: value }))}
        value={timeZone}
        onChange={setSelected}
        disabled={disabled}
        placeholder="Select time zone…"
        searchPlaceholder="Search time zones…"
      />
      <Input type="hidden" name="timeZone" value={timeZone} />
      {defaultValue === undefined && (
        <FieldDescription>
          Detected from your device. Choose the ward’s time zone if different.
        </FieldDescription>
      )}
    </Field>
  );
}
