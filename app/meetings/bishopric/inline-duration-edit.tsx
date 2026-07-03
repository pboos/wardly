"use client";

import { type KeyboardEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function InlineDurationEdit({
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
