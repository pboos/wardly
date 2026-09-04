"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconSettings } from "@tabler/icons-react";
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
import { updateSundayMeetingWardSettings } from "./actions";

/** Ward-level Sunday meeting settings: content locale and time zone. */
export function SundaySettingsDialog({
  contentLocale,
  timeZone,
}: {
  contentLocale: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState(contentLocale);
  const [zone, setZone] = useState(timeZone);

  function save() {
    startTransition(async () => {
      try {
        await updateSundayMeetingWardSettings({ contentLocale: locale, timeZone: zone });
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update ward settings.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <IconSettings data-icon="inline-start" />
        Settings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sunday meeting settings</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sunday-content-locale">Ward content locale</FieldLabel>
              <Input
                id="sunday-content-locale"
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                placeholder="en"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sunday-time-zone">Ward time zone</FieldLabel>
              <Input
                id="sunday-time-zone"
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                placeholder="Europe/Zurich"
              />
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
