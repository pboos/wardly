"use client";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AgendaRow } from "@/lib/leadership-meetings/loaders";
import type { ItemOutcome } from "@/lib/leadership-meetings/types";
import { ruleLabel } from "@/lib/leadership-meetings/calendar";
import { formatTimer, type MeetingTimer } from "./use-meeting-timer";
import { outcomeLabels } from "./outcome-dialog";
export function AgendaItem({
  item,
  readOnly,
  activeMeeting,
  pending,
  timer,
  onOutcome,
  onEdit,
  onTask,
  onStop,
  onMove,
  onRemove,
  today,
}: {
  item: AgendaRow;
  readOnly: boolean;
  activeMeeting: boolean;
  pending: boolean;
  timer: MeetingTimer;
  onOutcome: (outcome: ItemOutcome) => void;
  onEdit: () => void;
  onTask: () => void;
  onStop: () => void;
  onRemove: () => void;
  today: string;
  onMove: (direction: -1 | 1) => void;
}) {
  const unresolved = item.outcome === "pending",
    running = timer.runningId === item.id;
  const remaining = timer.remainingMs(item.id, item.durationMinutes);
  return (
    <Card role="group" aria-label={item.title}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="leading-relaxed">{item.title}</CardTitle>
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Actions for ${item.title}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  {unresolved && (
                    <>
                      <DropdownMenuItem disabled={pending} onSelect={onEdit}>
                        Edit item
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={pending}
                        onSelect={() => onOutcome("continued")}
                      >
                        Continue next meeting
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={pending}
                        onSelect={() => onOutcome("deferred")}
                      >
                        Move to next meeting
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={pending}
                        onSelect={() => onOutcome("skipped")}
                      >
                        Skip this occurrence
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={pending} onSelect={onRemove}>
                        Remove from this agenda
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem disabled={pending} onSelect={onTask}>
                    Add follow-up task
                  </DropdownMenuItem>
                  {item.repeating && (
                    <DropdownMenuItem disabled={pending} onSelect={onStop}>
                      Stop repeating
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={() => onMove(-1)}
                  >
                    <ArrowUp />
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={() => onMove(1)}
                  >
                    <ArrowDown />
                    Move down
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{item.durationMinutes} min</Badge>
          {item.repeating && (
            <Badge variant="outline">{ruleLabel(item.recurrence)}</Badge>
          )}
          {!unresolved && (
            <Badge>
              {outcomeLabels[item.outcome as ItemOutcome] ?? item.outcome}
            </Badge>
          )}
          {unresolved && item.dueDates.some((date) => date < today) && (
            <Badge variant="destructive">Overdue</Badge>
          )}
          {item.predecessorId && (
            <Badge variant="outline">Carried forward</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {item.dueDates.length > 0 &&
          item.recurrence.kind !== "every_meeting" && (
            <p className="text-xs text-muted-foreground">
              Due {item.dueDates.join(", ")}
              {item.dueDates.length > 1 ? " · combined discussion" : ""}
            </p>
          )}
        {item.decision && (
          <p className="whitespace-pre-wrap text-sm">{item.decision}</p>
        )}
        {item.tasks.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {item.tasks.map((t) => (
              <li key={t.id}>
                <Link href="/tasks" className="text-primary underline">
                  {t.title}
                </Link>{" "}
                · {t.completed ? "Completed" : "Open"}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && unresolved && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="min-w-16 font-mono text-lg tabular-nums"
              aria-label="Remaining time"
            >
              {formatTimer(remaining)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeMeeting}
              onClick={() =>
                running
                  ? timer.pause()
                  : timer.start(item.id, item.durationMinutes)
              }
              aria-label={`${running ? "Pause" : "Start"} timer for ${item.title}`}
            >
              {running ? <Pause /> : <Play />}
              {running ? "Pause" : "Start"}
            </Button>
            {[1, 2, 5].map((minutes) => (
              <Button
                key={minutes}
                variant="ghost"
                size="sm"
                disabled={!activeMeeting}
                onClick={() =>
                  timer.extend(item.id, item.durationMinutes, minutes)
                }
                aria-label={`Extend timer for ${item.title} by ${minutes} minutes`}
              >
                <Plus />
                {minutes} min
              </Button>
            ))}
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onOutcome("done")}
            >
              Done
            </Button>
            {remaining <= 0 && (
              <span className="text-sm text-destructive">
                Time is up. Extend or finish the discussion.
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
