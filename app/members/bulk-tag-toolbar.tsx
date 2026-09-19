"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TagOptions } from "./tag-options";
import type { MemberTag } from "./tags";

export function BulkTagToolbar({
  count,
  tags,
  pending,
  onClear,
  onApply,
}: {
  count: number;
  tags: MemberTag[];
  pending: boolean;
  onClear: () => void;
  onApply: (tagIds: string[], operation: "add" | "remove") => void;
}) {
  const [mode, setMode] = useState<"add" | "remove" | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const chosen = selected.filter((id) => tags.some((tag) => tag.id === id));
  return (
    <>
      <div
        role="region"
        aria-label="Selected members"
        className="flex flex-wrap items-center gap-2 rounded-md border bg-muted p-3"
      >
        <span className="text-sm font-medium" aria-live="polite">
          {count} selected
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !tags.length}
          onClick={() => {
            setSelected([]);
            setMode("add");
          }}
        >
          Add tags
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !tags.length}
          onClick={() => {
            setSelected([]);
            setMode("remove");
          }}
        >
          Remove tags
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onClear}>
          Clear
        </Button>
        {!tags.length && (
          <span className="text-sm text-muted-foreground">
            Create tags in Manage tags first.
          </span>
        )}
      </div>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setMode(null);
        }}
      >
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto"
          showCloseButton={!pending}
        >
          <DialogHeader>
            <DialogTitle>
              {mode === "add" ? "Add tags" : "Remove tags"}
            </DialogTitle>
            <DialogDescription>
              {mode === "add"
                ? "Add the chosen tags to"
                : "Remove the chosen tags from"}{" "}
              {count} selected members. Other tags stay unchanged.
            </DialogDescription>
          </DialogHeader>
          <TagOptions
            label="Choose tags"
            tags={tags}
            selected={chosen}
            disabled={pending}
            onChange={(id, checked) =>
              setSelected((ids) =>
                checked ? [...ids, id] : ids.filter((value) => value !== id),
              )
            }
          />
          {chosen.length > 50 && (
            <p role="alert" className="text-sm text-destructive">
              Choose up to 50 tags at a time.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setMode(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending || !chosen.length || chosen.length > 50}
              onClick={() => mode && onApply(chosen, mode)}
            >
              {pending ? "Applying…" : `Apply to ${count} members`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
