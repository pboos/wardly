"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { LeadershipData } from "@/lib/leadership-meetings/loaders";
import type { MeetingCommand } from "@/lib/leadership-meetings/types";
import { ChoiceField } from "./choice-field";
export function MeetingControlsDialog({
  meeting,
  mode,
  pending,
  onClose,
  onSave,
}: {
  meeting: NonNullable<LeadershipData["meeting"]>;
  mode: "reschedule" | "close" | "cancel";
  pending: boolean;
  onClose: () => void;
  onSave: (command: MeetingCommand) => Promise<void>;
}) {
  const [date, setDate] = useState(meeting.date),
    [time, setTime] = useState(meeting.start_time),
    [unfinished, setUnfinished] = useState<"defer" | "skip">("defer");
  const label =
    mode === "reschedule"
      ? "Reschedule meeting"
      : mode === "close"
        ? "Close meeting"
        : "Cancel meeting";
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {mode === "reschedule"
              ? "Change this meeting only. Its agenda is retained."
              : "Resolved items remain in history. Choose what happens to any unfinished discussions."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(
              mode === "reschedule"
                ? {
                    kind: "reschedule",
                    meetingId: meeting.id,
                    date,
                    startTime: time,
                  }
                : {
                    kind: "meeting",
                    meetingId: meeting.id,
                    operation: mode,
                    unfinished,
                  },
            );
          }}
        >
          <FieldGroup>
            {mode === "reschedule" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="reschedule-date">
                    Meeting date
                  </FieldLabel>
                  <Input
                    id="reschedule-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reschedule-time">Start time</FieldLabel>
                  <Input
                    id="reschedule-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </Field>
              </>
            ) : (
              <ChoiceField
                id="unfinished"
                label="Unfinished items"
                value={unfinished}
                onChange={(v) => setUnfinished(v === "skip" ? "skip" : "defer")}
                options={[
                  { value: "defer", label: "Move to next meeting" },
                  { value: "skip", label: "Skip these occurrences" },
                ]}
              />
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : label}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
