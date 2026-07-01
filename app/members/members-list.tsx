"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  updateMemberStatus,
  type MemberStatus,
} from "./actions";

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string | null;
  email: string | null;
  is_baptized: boolean;
  status: string;
};

type StatusScope = "active" | "except_moved" | "all";

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

export function MembersList({
  members,
  onShownCountChange,
}: {
  members: Member[];
  onShownCountChange?: (count: number) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [localMembers, setLocalMembers] = useState<Member[]>(members);
  const [nameQuery, setNameQuery] = useState("");
  const [statusScope, setStatusScope] = useState<StatusScope>("active");

  // Reset local state when the server-provided prop changes (e.g. after reload).
  // Adjusting state during render avoids cascading renders from useEffect.
  const [prevMembers, setPrevMembers] = useState(members);
  if (members !== prevMembers) {
    setPrevMembers(members);
    setLocalMembers(members);
  }

  const filtered = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    return localMembers.filter((m) => {
      if (statusScope === "active" && m.status !== "active") return false;
      if (statusScope === "except_moved" && m.status === "moved") return false;

      if (q) {
        const full = `${m.first_name} ${m.last_name}`.toLowerCase();
        if (
          !full.includes(q) &&
          !m.first_name.toLowerCase().includes(q) &&
          !m.last_name.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [localMembers, nameQuery, statusScope]);

  useEffect(() => {
    onShownCountChange?.(filtered.length);
  }, [filtered, onShownCountChange]);

  function handleStatusChange(member: Member, newStatus: MemberStatus) {
    setLocalMembers((prev) =>
      prev.map((m) =>
        m.id === member.id ? { ...m, status: newStatus } : m,
      ),
    );
    startTransition(async () => {
      try {
        await updateMemberStatus(member.id, newStatus);
      } catch {
        toast.error(
          "Failed to update the member's status. We recommend reloading the data to make sure the list is accurate.",
          {
            action: {
              label: "Reload",
              onClick: () => router.refresh(),
            },
          },
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5 sm:flex-1">
          <Label htmlFor="name-filter">Filter by name</Label>
          <Input
            id="name-filter"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Search members…"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <Label htmlFor="status-scope">Status</Label>
          <Select
            value={statusScope}
            onValueChange={(v) => setStatusScope(v as StatusScope)}
          >
            <SelectTrigger id="status-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="except_moved">All except moved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No members match.
        </p>
      ) : (
        <>
          <p>{filtered.length} members.</p>
          {/* Desktop: table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Birth date</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Baptized</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.last_name}, {m.first_name}
                    </TableCell>
                    <TableCell>{m.gender}</TableCell>
                    <TableCell>{m.birth_date ?? "—"}</TableCell>
                    <TableCell>{m.email ?? "—"}</TableCell>
                    <TableCell>
                      {m.is_baptized ? (
                        <IconCheck className="size-4" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        member={m}
                        onStatusChange={handleStatusChange}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: name-only list */}
          <ul className="flex flex-col divide-y divide-border sm:hidden">
            {filtered.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 text-sm">
                  {m.first_name} {m.last_name}
                </span>
                <StatusBadge
                  member={m}
                  onStatusChange={handleStatusChange}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function StatusBadge({
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
        aria-label={isMoved ? undefined : `Edit status of ${member.first_name} ${member.last_name}`}
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
        <SelectValue placeholder={STATUS_LABEL[member.status] ?? member.status} />
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
