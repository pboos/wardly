"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Member } from "./members-list";
import type { MemberStatus } from "./actions";

const STATUS_BADGE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  unknown: "outline",
  unknown_address: "outline",
  no_contact: "outline",
  moved: "outline",
  hidden: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  moved: "Moved",
  unknown: "Unknown",
  unknown_address: "Unknown address",
  no_contact: "No contact",
  hidden: "Hidden",
};

const TARGET_STATUSES: MemberStatus[] = [
  "active",
  "unknown",
  "unknown_address",
  "no_contact",
  "hidden",
];

export function StatusBadge({
  member,
  onStatusChange,
}: {
  member: Member;
  onStatusChange: (member: Member, status: MemberStatus) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isMoved = member.status === "moved";

  if (isMoved || !editing) {
    return (
      <button
        type="button"
        disabled={isMoved}
        onClick={() => setEditing(true)}
        className={cn(
          "inline-flex items-center rounded-4xl transition-colors",
          !isMoved &&
            "cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isMoved && "cursor-default",
        )}
        aria-label={
          isMoved
            ? undefined
            : `Edit status of ${member.first_name} ${member.last_name}`
        }
      >
        <Badge
          variant={STATUS_BADGE_VARIANT[member.status] ?? "outline"}
          className={cn(member.status === "moved" && "text-muted-foreground")}
        >
          {STATUS_LABEL[member.status] ?? member.status}
        </Badge>
      </button>
    );
  }

  return (
    <Select
      open={editing}
      onOpenChange={(o) => {
        if (!o) setEditing(false);
      }}
      value=""
      onValueChange={(v) => {
        setEditing(false);
        onStatusChange(member, v as MemberStatus);
      }}
    >
      <SelectTrigger size="sm" className="min-w-36">
        <SelectValue
          placeholder={STATUS_LABEL[member.status] ?? member.status}
        />
      </SelectTrigger>
      <SelectContent>
        {TARGET_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
