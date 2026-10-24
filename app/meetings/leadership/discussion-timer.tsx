"use client";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgendaRow } from "@/lib/leadership-meetings/loaders";
import { formatTimer, type MeetingTimer } from "./use-meeting-timer";
export function DiscussionTimer({
  item,
  timer,
  pending,
  onStart,
}: {
  item: AgendaRow;
  timer: MeetingTimer;
  pending: boolean;
  onStart: () => void;
}) {
  const remaining = timer.remainingMs(item.id, item.durationMinutes),
    running = timer.runningId === item.id;
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-muted p-3 sm:flex-row sm:flex-wrap sm:justify-between">
      <span
        className="font-mono text-3xl tabular-nums"
        aria-label="Remaining discussion time"
        role="timer"
      >
        {formatTimer(remaining)}
      </span>
      {remaining <= 0 && (
        <p role="status" className="text-center font-medium text-destructive">
          Time is up. Extend or finish the discussion.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" disabled={pending} onClick={running ? timer.pause : onStart}>
          {running ? (
            <Pause data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {running ? "Pause" : timer.hasStarted(item.id) ? "Resume" : "Start"}
        </Button>
        {[1, 2, 5].map((minutes) => (
          <Button
            key={minutes}
            size="sm"
            variant="outline"
            onClick={() => timer.extend(item.id, item.durationMinutes, minutes)}
            aria-label={`Extend by ${minutes} minutes`}
          >
            +{minutes} min
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={timer.toggleMuted}
          aria-pressed={timer.muted}
        >
          {timer.muted ? (
            <VolumeX data-icon="inline-start" />
          ) : (
            <Volume2 data-icon="inline-start" />
          )}
          {timer.muted ? "Unmute alarm" : "Mute alarm"}
        </Button>
        <Button size="sm" variant="ghost" onClick={timer.testSound}>
          Test sound
        </Button>
      </div>
      {timer.soundError && (
        <p role="alert" className="text-sm text-destructive">
          {timer.soundError}
        </p>
      )}
    </div>
  );
}
