"use client";

import { useOptimistic, useTransition } from "react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { IconDoorExit } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setMemberTag } from "./actions";
import { TagBadge } from "./tag-badge";
import { TagPicker } from "./tag-picker";
import type { MemberTag } from "./tags";

export function MemberTags({
  memberId,
  name,
  tagIds,
  tags,
  movedOut = false,
  compact = false,
}: {
  memberId: string;
  name: string;
  tagIds: string[];
  tags: MemberTag[];
  movedOut?: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, update] = useOptimistic(
    tagIds,
    (ids, change: { id: string; assigned: boolean }) =>
      change.assigned
        ? [...new Set([...ids, change.id])]
        : ids.filter((id) => id !== change.id),
  );
  const assignedTags = tags.filter((tag) => selected.includes(tag.id));
  const summary = [
    ...(movedOut ? ["Moved out (managed by sync)"] : []),
    ...assignedTags.map((tag) => tag.name),
  ].join(", ");
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1",
        compact ? "w-1/2 shrink-0 justify-end" : "w-full",
      )}
    >
      <div
        className={cn(
          "min-w-0",
          compact
            ? "truncate text-right"
            : "flex flex-wrap items-center gap-1.5",
        )}
        title={summary || undefined}
      >
        {movedOut && (
          <>
            <Badge
              variant="secondary"
              title="Moved out — managed by member sync"
            >
              <IconDoorExit data-icon="inline-start" />
              Moved out
            </Badge>
            {compact && " "}
          </>
        )}
        {assignedTags.map((tag) => (
          <Fragment key={tag.id}>
            <TagBadge tag={tag} />
            {compact && " "}
          </Fragment>
        ))}
      </div>
      <TagPicker
        iconOnly
        label={`Edit tags for ${name}`}
        tags={tags}
        selected={selected}
        disabled={pending}
        onChange={(id, assigned) =>
          startTransition(async () => {
            update({ id, assigned });
            try {
              await setMemberTag(memberId, id, assigned);
            } catch {
              toast.error("Could not save tags. Your change was reverted.");
            }
          })
        }
      />
    </div>
  );
}
