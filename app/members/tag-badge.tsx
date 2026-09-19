import { Badge } from "@/components/ui/badge";
import type { MemberTag } from "./tags";

export function TagBadge({ tag }: { tag: Pick<MemberTag, "name" | "color"> }) {
  return (
    <Badge variant="memberTag" data-color={tag.color} className="max-w-full">
      <span className="truncate">{tag.name}</span>
    </Badge>
  );
}
