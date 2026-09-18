"use client";

import { useOptimistic, useTransition } from "react";
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
}: {
  memberId: string;
  name: string;
  tagIds: string[];
  tags: MemberTag[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, update] = useOptimistic(
    tagIds,
    (ids, change: { id: string; assigned: boolean }) =>
      change.assigned
        ? [...new Set([...ids, change.id])]
        : ids.filter((id) => id !== change.id),
  );
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {tags
        .filter((tag) => selected.includes(tag.id))
        .map((tag) => (
          <TagBadge key={tag.id} tag={tag} />
        ))}
      <TagPicker
        buttonText="Edit tags"
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
