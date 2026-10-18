"use client";
import { useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  GripVertical,
  ListTodo,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgendaRow } from "@/lib/leadership-meetings/loaders";
import { ruleLabel } from "@/lib/leadership-meetings/calendar";
import { formatTimer, type MeetingTimer } from "./use-meeting-timer";
export function AgendaItem({
  item,
  readOnly,
  pending,
  timer,
  onOpen,
  onStart,
  onReorder,
  onComplete,
  today,
  users,
}: {
  item: AgendaRow;
  readOnly: boolean;
  pending: boolean;
  timer: MeetingTimer;
  onOpen: () => void;
  onComplete: () => void;
  onStart: () => void;
  onReorder: (target: string | -1 | 1) => void;
  today: string;
  users: { id: string; name: string }[];
}) {
  const [dragging, setDragging] = useState(false);
  const target = useRef<string | null>(null);
  const running = timer.runningId === item.id;
  const unresolved = item.outcome === "pending";
  const assignee = users.find((user) => user.id === item.assignedUserId);
  return (
    <div
      data-agenda-id={item.id}
      role="group"
      aria-label={item.title}
      onClick={onOpen}
      className={cn(
        "flex cursor-pointer items-center gap-1 rounded-lg border bg-card px-1 py-2 sm:gap-2 sm:px-3",
        running && "ring-2 ring-primary",
        dragging && "opacity-50",
      )}
    >
      <div className="flex shrink-0 flex-col sm:flex-row sm:items-center sm:gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={readOnly || pending}
          aria-label={`Reorder ${item.title}. Use up and down arrow keys.`}
          className="shrink-0 touch-none cursor-grab"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              onReorder(event.key === "ArrowUp" ? -1 : 1);
            }
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            target.current = null;
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!dragging) return;
            target.current =
              document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>("[data-agenda-id]")?.dataset.agendaId ??
              null;
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            setDragging(false);
            if (target.current && target.current !== item.id)
              onReorder(target.current);
            target.current = null;
          }}
          onPointerCancel={() => {
            setDragging(false);
            target.current = null;
          }}
        >
          <GripVertical />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label={`${unresolved && !readOnly ? "Mark done" : "Discuss"} ${item.title}`}
          onClick={(event) => {
            event.stopPropagation();
            if (unresolved && !readOnly) onComplete();
            else onOpen();
          }}
        >
          {unresolved ? <Circle /> : <CheckCircle2 />}
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          variant="ghost"
          className="h-auto min-w-0 max-w-full justify-start whitespace-normal break-words [overflow-wrap:anywhere] px-0 py-1 text-left"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {item.title}
        </Button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {item.tasks.length > 0 && (
            <span className="inline-flex items-center gap-1 sm:hidden">
              <ListTodo className="size-3" />{item.tasks.length} tasks
            </span>
          )}
          {item.repeating && <span>{ruleLabel(item.recurrence)}</span>}
          {!unresolved && (
            <span>
              {item.outcome === "done"
                ? "Done"
                : item.outcome === "continued"
                  ? "Continued"
                  : item.outcome === "deferred"
                    ? "Moved"
                    : "Skipped"}
            </span>
          )}
          {unresolved && item.dueDates.some((date) => date < today) && (
            <Badge variant="destructive">Overdue</Badge>
          )}
          {running && (
            <span className="font-mono text-primary tabular-nums">
              {formatTimer(timer.remainingMs(item.id, item.durationMinutes))}
            </span>
          )}
        </div>
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:w-12">
        {item.durationMinutes + timer.extension(item.id)} min
      </span>
      <div className="hidden shrink-0 justify-center sm:flex sm:w-10">
        {item.tasks.length > 0 && (
          <Button variant="ghost" size="icon-sm"
            aria-label={`${item.tasks.length} follow-up tasks for ${item.title}`}
            onClick={(event) => { event.stopPropagation(); onOpen(); }}>
            <span className="inline-flex items-center gap-0.5 text-xs"><ListTodo className="size-3" />{item.tasks.length}</span>
          </Button>
        )}
      </div>
      <div className="flex w-6 shrink-0 justify-center" title={assignee?.name} aria-label={assignee ? `Assigned to ${assignee.name}` : undefined}>
        {assignee && <UserAvatar name={assignee.name} size="sm" />}
      </div>
      <div className="w-8 shrink-0">
        {!readOnly && unresolved && (
          <Button size="icon-sm" disabled={pending}
            aria-label={`${running ? "Open" : "Start"} ${item.title}`}
            onClick={(event) => { event.stopPropagation(); onStart(); }}>
            <Play />
          </Button>
        )}
      </div>
    </div>
  );
}
