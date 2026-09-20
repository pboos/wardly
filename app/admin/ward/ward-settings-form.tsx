"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WardTimeZoneField } from "@/components/ward-time-zone-field";
import { hymnLanguages } from "@/lib/hymns/locales";
import { updateWardSettings } from "./actions";

export function WardSettingsForm({
  ward,
  timeZones,
}: {
  ward: {
    name: string;
    content_locale: string;
    time_zone: string;
    sacrament_start_time: string | null;
  };
  timeZones: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            const result = await updateWardSettings(data);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast.success("Ward settings saved.");
          } catch {
            setError("Could not save ward settings. Please try again.");
          }
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="wardName">Ward name</FieldLabel>
          <Input
            id="wardName"
            name="wardName"
            defaultValue={ward.name}
            required
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contentLocale">Ward language</FieldLabel>
          <Select
            name="contentLocale"
            defaultValue={ward.content_locale}
            required
            disabled={pending}
          >
            <SelectTrigger id="contentLocale" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {hymnLanguages.map(({ locale, label }) => (
                  <SelectItem key={locale} value={locale}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
            defaultValue={ward.sacrament_start_time ?? ""}
            required
            disabled={pending}
          />
          <FieldDescription>
            Local ward time. Assigned task reminders are emailed every Sunday
            one hour before.
          </FieldDescription>
        </Field>
        <WardTimeZoneField
          timeZones={timeZones}
          defaultValue={ward.time_zone}
          disabled={pending}
        />
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </FieldGroup>
    </form>
  );
}
