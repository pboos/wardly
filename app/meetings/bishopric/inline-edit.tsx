"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function InlineEdit({
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

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
        ref={inputRef}
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
