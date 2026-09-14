"use client";
import { IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SundayMeetingItem } from "@/lib/sunday-meetings/types";

export function SundayPersonChip({
  item,
  label,
  pending,
  onRemove,
}: {
  item: SundayMeetingItem;
  label: string;
  pending: boolean;
  onRemove: () => void;
}) {
  return (
    <Badge
      variant={item.personMemberId === null ? "destructive" : "secondary"}
      className="h-auto min-h-7 min-w-0 max-w-full shrink gap-1 py-0.5 pl-2 pr-0.5"
    >
      <span className="min-w-0 whitespace-normal break-words">
        {item.personNameResolved}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        disabled={pending}
        aria-label={`Remove ${item.personNameResolved} from ${label}`}
        onClick={onRemove}
      >
        <IconX />
      </Button>
    </Badge>
  );
}
