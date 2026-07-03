"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  IconCheck,
  IconCircle,
  IconClock,
  IconGripVertical,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBishopricMeeting } from "@/lib/meetings/use-bishopric-meeting";
import { useCountdownTimer } from "@/lib/meetings/use-countdown-timer";
import { useMuted } from "@/lib/meetings/use-muted";
import { playAlarm } from "@/lib/meetings/play-alarm";

function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BishopricMeetingView() {
  const meeting = useBishopricMeeting();
  const [muted, setMuted] = useMuted();

  const handleElapsed = useCallback(() => {
    if (!muted) playAlarm();
  }, [muted]);

  const timer = useCountdownTimer(handleElapsed);

  const timerActive = timer.state.itemId !== null;
  const activeItem = useMemo(
    () => meeting.items.find((it) => it.id === timer.state.itemId) ?? null,
    [meeting.items, timer.state.itemId],
  );

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (timerActive) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [timerActive]);

  const handleStart = useCallback(
    (id: string, durationMin: number) => {
      if (timerActive) return;
      timer.start(id, durationMin);
    },
    [timer, timerActive],
  );

  const handleDone = useCallback(() => {
    if (timer.state.itemId) {
      meeting.markDone(timer.state.itemId);
    }
    timer.closeModal();
  }, [meeting, timer]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">
          Bishopric Meeting
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={muted}
            aria-label={muted ? "Unmute alarm" : "Mute alarm"}
            title={muted ? "Unmute alarm" : "Mute alarm"}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <IconVolumeOff /> : <IconVolume />}
          </Button>
          <ResetButton onConfirm={meeting.reset} disabled={timerActive} />
        </div>
      </div>

      <AddItemRow onAdd={meeting.addItem} disabled={timerActive} />

      <AgendaList
        items={meeting.items}
        completedIds={meeting.completedIds}
        activeItemId={timer.state.itemId}
        timerActive={timerActive}
        onToggleDone={(id, done) =>
          done ? meeting.markDone(id) : meeting.unmarkDone(id)
        }
        onUpdate={meeting.updateItem}
        onRemove={meeting.removeItem}
        onMove={meeting.moveItem}
        onStart={handleStart}
      />

      <TimerModal
        open={timer.state.isModalOpen}
        status={timer.state.status}
        remainingMs={timer.state.remainingMs}
        totalMs={
          activeItem ? activeItem.durationMin * 60_000 : 0
        }
        itemName={activeItem?.name ?? ""}
        onExtend={(min) => timer.extend(min)}
        onStop={timer.stop}
        onAbort={timer.closeModal}
        onDone={handleDone}
      />
    </div>
  );
}

function ResetButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <IconRefresh />
        Reset
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to defaults?</DialogTitle>
            <DialogDescription>
              This replaces your current agenda with the default items and
              clears all checkmarks. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              Reset to defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddItemRow({
  onAdd,
  disabled,
}: {
  onAdd: (name: string, durationMin: number) => void;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");

  const submit = () => {
    const mins = Number.parseInt(duration, 10);
    if (!name.trim() || !Number.isFinite(mins) || mins <= 0) return;
    onAdd(name, mins);
    setName("");
    setDuration("");
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Add agenda item"
        className="min-w-40 flex-1"
        aria-label="New item name"
      />
      <Input
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Min"
        type="number"
        min={1}
        inputMode="numeric"
        className="w-20"
        aria-label="New item duration in minutes"
      />
      <Button size="sm" onClick={submit} disabled={disabled}>
        <IconPlus />
        Add
      </Button>
    </div>
  );
}

type AgendaListProps = {
  items: { id: string; name: string; durationMin: number }[];
  completedIds: string[];
  activeItemId: string | null;
  timerActive: boolean;
  onToggleDone: (id: string, done: boolean) => void;
  onUpdate: (
    id: string,
    patch: Partial<{ name: string; durationMin: number }>,
  ) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onStart: (id: string, durationMin: number) => void;
};

function AgendaList({
  items,
  completedIds,
  activeItemId,
  timerActive,
  onToggleDone,
  onUpdate,
  onRemove,
  onMove,
  onStart,
}: AgendaListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (e: DragEvent<HTMLButtonElement>) => {
    if (timerActive) {
      e.preventDefault();
      return;
    }
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (index: number) => (e: DragEvent<HTMLLIElement>) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = (index: number) => (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      onMove(dragIndex, index);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No agenda items yet. Add one above or reset to defaults.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((item, index) => {
        const done = completedIds.includes(item.id);
        const isActive = item.id === activeItemId;
        return (
          <li
            key={item.id}
            draggable={false}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-card p-2 transition-colors",
              overIndex === index && dragIndex !== null && "bg-muted",
              dragIndex === index && "opacity-50",
              isActive && "ring-2 ring-primary/40",
            )}
          >
            <button
              type="button"
              draggable={!timerActive}
              onDragStart={handleDragStart(index)}
              onDragEnd={handleDragEnd}
              disabled={timerActive}
              aria-label="Drag to reorder"
              className={cn(
                "shrink-0 cursor-grab text-muted-foreground touch-none",
                "hover:text-foreground",
                "disabled:cursor-not-allowed disabled:opacity-30",
                "active:cursor-grabbing",
              )}
            >
              <IconGripVertical className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => onToggleDone(item.id, !done)}
              aria-label={done ? "Mark as not done" : "Mark as done"}
              className={cn(
                "shrink-0",
                done ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {done ? (
                <IconCheck className="size-5" />
              ) : (
                <IconCircle className="size-5" />
              )}
            </button>

            <InlineEdit
              value={item.name}
              onSave={(v) => onUpdate(item.id, { name: v })}
              disabled={timerActive}
              className="flex-1"
            />
            <InlineDurationEdit
              value={item.durationMin}
              onSave={(v) => onUpdate(item.id, { durationMin: v })}
              disabled={timerActive}
            />

            {isActive && (
              <IconClock
                className="size-4 shrink-0 text-primary"
                aria-label="Active"
              />
            )}

            <Button
              variant="default"
              size="sm"
              disabled={timerActive}
              onClick={() => onStart(item.id, item.durationMin)}
            >
              Start
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove item"
              disabled={timerActive}
              onClick={() => onRemove(item.id)}
            >
              <IconTrash />
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

function InlineEdit({
  value,
  onSave,
  disabled,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const beginEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <Input
        ref={(el) => el?.select()}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        className={cn("h-7", className)}
        aria-label="Edit item name"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={beginEdit}
      className={cn(
        "truncate rounded px-1.5 py-0.5 text-left text-sm hover:bg-muted",
        disabled && "cursor-default",
        className,
      )}
      title={value}
    >
      {value}
    </button>
  );
}

function InlineDurationEdit({
  value,
  onSave,
  disabled,
}: {
  value: number;
  onSave: (v: number) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const beginEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const mins = Number.parseInt(draft, 10);
    if (Number.isFinite(mins) && mins > 0 && mins !== value) onSave(mins);
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <Input
        ref={(el) => el?.select()}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        type="number"
        min={1}
        inputMode="numeric"
        className="h-7 w-16"
        aria-label="Edit item duration in minutes"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={beginEdit}
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted",
        disabled && "cursor-default",
      )}
    >
      {value}m
    </button>
  );
}

type TimerModalProps = {
  open: boolean;
  status: "idle" | "running" | "elapsed";
  remainingMs: number;
  totalMs: number;
  itemName: string;
  onExtend: (min: number) => void;
  onStop: () => void;
  onAbort: () => void;
  onDone: () => void;
};

function TimerModal({
  open,
  status,
  remainingMs,
  totalMs,
  itemName,
  onExtend,
  onStop,
  onAbort,
  onDone,
}: TimerModalProps) {
  const elapsed = status === "elapsed";
  const progress =
    totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) return;
      }}
    >
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            {elapsed ? "Time's up!" : itemName || "Timer"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {elapsed ? `${itemName}` : "Counting down"}
          </DialogDescription>
        </DialogHeader>

        <CountdownRing
          remainingMs={remainingMs}
          progress={progress}
          elapsed={elapsed}
        />

        <div className="flex flex-col gap-2">
          {elapsed ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => onExtend(1)}>
                  +1 min
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExtend(2)}>
                  +2 min
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExtend(5)}>
                  +5 min
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" size="sm" onClick={onAbort}>
                  Abort
                </Button>
                <Button size="sm" onClick={onDone}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => onExtend(1)}>
                  +1 min
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExtend(2)}>
                  +2 min
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExtend(5)}>
                  +5 min
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={onStop}>
                Stop
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CountdownRing({
  remainingMs,
  progress,
  elapsed,
}: {
  remainingMs: number;
  progress: number;
  elapsed: boolean;
}) {
  const size = 160;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (elapsed ? 0 : progress);

  return (
    <div className="flex items-center justify-center py-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(
            elapsed ? "stroke-destructive" : "stroke-primary",
            "transition-[stroke-dashoffset] duration-200 ease-linear",
          )}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - dash}
        />
      </svg>
      <span className="absolute text-3xl font-semibold tabular-nums">
        {elapsed ? "0:00" : formatMs(remainingMs)}
      </span>
    </div>
  );
}
