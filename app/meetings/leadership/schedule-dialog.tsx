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
import { Input } from "@/components/ui/input";
import type { LeadershipData } from "@/lib/leadership-meetings/loaders";
import type { MeetingCommand } from "@/lib/leadership-meetings/types";
import { RecurrenceFields } from "./recurrence-fields";
export function ScheduleDialog({
  data,
  pending,
  onClose,
  onSave,
}: {
  data: LeadershipData;
  pending: boolean;
  onClose: () => void;
  onSave: (command: MeetingCommand) => Promise<void>;
}) {
  const [anchorDate, setAnchorDate] = useState(
    data.series?.anchor ?? data.today,
  );
  const [schedule, setSchedule] = useState(
    data.series?.schedule ?? {
      version: 1 as const,
      kind: "weeks" as const,
      interval: 1,
      weekday: 0,
    },
  );
  const [startTime, setStartTime] = useState(data.series?.startTime ?? "09:00");
  const targetMinutes = data.series?.targetMinutes ?? 60;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data.series
              ? "Meeting schedule"
              : `Set up ${data.title.toLowerCase()} meetings`}
          </DialogTitle>
          <DialogDescription>
            Dates and times use {data.timeZone}. Opening this page automatically
            prepares the next three calendar months. Changes affect unstarted
            meetings in that window; later saved meetings are kept. Individual
            cancellations remain exceptions. Keep the schedule start date to
            preserve the current recurrence pattern.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(
              data.series
                ? {
                    kind: "schedule",
                    seriesId: data.series.id,
                    anchorDate,
                    schedule,
                    startTime,
                    targetMinutes,
                  }
                : {
                    kind: "initialize",
                    meetingKind: data.kind,
                    anchorDate,
                    schedule,
                    startTime,
                    targetMinutes,
                  },
            );
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="schedule-anchor">Schedule starts</FieldLabel>
              <Input
                id="schedule-anchor"
                type="date"
                required
                min={
                  data.series?.anchor && data.series.anchor < data.today
                    ? data.series.anchor
                    : data.today
                }
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            </Field>
            <RecurrenceFields
              value={schedule}
              onChange={setSchedule}
              scheduleOnly
            />
            <Field>
              <FieldLabel htmlFor="schedule-time">Start time</FieldLabel>
              <Input
                id="schedule-time"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Field>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save schedule"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
