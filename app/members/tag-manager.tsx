"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteTag } from "./actions";
import { TagBadge } from "./tag-badge";
import { TagEditor } from "./tag-editor";
import type { MemberTag } from "./tags";

export function TagManager({
  tags,
  disabled = false,
}: {
  tags: MemberTag[];
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState<MemberTag | "new" | null>(null);
  const [deleting, setDeleting] = useState<MemberTag | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      onOpenChange={() => {
        setEditing(null);
        setDeleting(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Manage tags
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {deleting
              ? "Delete tag?"
              : editing
                ? editing === "new"
                  ? "Create tag"
                  : "Edit tag"
                : "Manage tags"}
          </DialogTitle>
          <DialogDescription>
            {deleting
              ? `Delete “${deleting.name}” and remove it from ${deleting.memberCount} members? Members will not be deleted.`
              : "Tags are shared with everyone in your ward."}
          </DialogDescription>
        </DialogHeader>
        {deleting ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await deleteTag(deleting.id);
                    setDeleting(null);
                    toast.success("Tag deleted.");
                  } catch {
                    toast.error("Could not delete tag. Reload and try again.");
                  }
                })
              }
            >
              {pending ? "Deleting…" : "Delete tag"}
            </Button>
          </div>
        ) : editing ? (
          <TagEditor
            key={editing === "new" ? "new" : editing.id}
            tag={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <Button onClick={() => setEditing("new")}>Create tag</Button>
            {!tags.length && (
              <p className="text-sm text-muted-foreground">
                No tags yet. Create your first tag to label members.
              </p>
            )}
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <TagBadge tag={tag} />
                  <span className="text-xs text-muted-foreground">
                    {tag.memberCount} members
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${tag.name}`}
                    onClick={() => setEditing(tag)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${tag.name}`}
                    onClick={() => setDeleting(tag)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
