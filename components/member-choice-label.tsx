import { TagBadge } from "@/app/members/tag-badge";
import type { MemberChoice } from "@/lib/members/choices";
import { cn } from "@/lib/utils";

export function MemberChoiceLabel({
  item,
  labelClassName,
}: {
  item: MemberChoice;
  labelClassName?: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span
        className={cn(
          labelClassName ?? "whitespace-normal break-words",
          !!item.exclusionTags?.length && "text-muted-foreground",
        )}
      >
        {item.label}
      </span>
      {!!item.exclusionTags?.length && (
        <span className="flex flex-wrap gap-1">
          {item.exclusionTags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </span>
      )}
    </span>
  );
}
