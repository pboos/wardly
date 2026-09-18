"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconCheck } from "@tabler/icons-react";
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
import { groupMembersByHousehold } from "./households";
import { StatusBadge } from "./status-badge";
import { updateMemberStatus, type MemberStatus } from "./actions";

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string | null;
  email: string | null;
  is_baptized: boolean;
  status: string;
  external_household_uuid: string | null;
  external_household_role: string | null;
};

type StatusScope = "active" | "except_moved" | "all";

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

  const households = useMemo(() => {
    const visibleIds = new Set(filtered.map((member) => member.id));
    return groupMembersByHousehold(localMembers)
      .map((household) => ({
        ...household,
        members: household.members.filter((member) =>
          visibleIds.has(member.id),
        ),
      }))
      .filter((household) => household.members.length > 0);
  }, [localMembers, filtered]);

  useEffect(() => {
    onShownCountChange?.(filtered.length);
  }, [filtered, onShownCountChange]);

  function handleStatusChange(member: Member, newStatus: MemberStatus) {
    setLocalMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, status: newStatus } : m)),
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
              {households.map((household, index) => (
                <TableBody
                  key={household.key}
                  aria-label={household.label}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    index % 2 === 1 && "bg-muted/40",
                  )}
                >
                  {household.members.map((m) => (
                    <TableRow key={m.id} className="border-0">
                      <TableCell
                        className={cn(
                          "font-medium",
                          household.isHousehold &&
                            m.id !== household.displayHeadId &&
                            "pl-6",
                        )}
                      >
                        {household.isHousehold &&
                          m.id === household.displayHeadId && (
                            <span className="sr-only">Head of household: </span>
                          )}
                        {m.last_name}, {m.first_name}
                      </TableCell>
                      <TableCell>{m.gender}</TableCell>
                      <TableCell>{m.birth_date ?? "—"}</TableCell>
                      <TableCell>{m.email ?? "—"}</TableCell>
                      <TableCell>
                        {m.is_baptized ? <IconCheck className="size-4" /> : "—"}
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
              ))}
            </Table>
          </div>

          {/* Mobile: name-only list */}
          <ul className="flex flex-col divide-y divide-border sm:hidden">
            {households.map((household, index) => (
              <li
                key={household.key}
                className={cn("py-1", index % 2 === 1 && "bg-muted/40")}
              >
                <ul aria-label={household.label}>
                  {household.members.map((m) => (
                    <li
                      key={m.id}
                      className={cn(
                        "flex items-center gap-3 px-2 py-2.5",
                        household.isHousehold &&
                          m.id !== household.displayHeadId &&
                          "pl-6",
                      )}
                    >
                      <span className="min-w-0 flex-1 break-words text-sm">
                        {household.isHousehold &&
                          m.id === household.displayHeadId && (
                            <span className="sr-only">Head of household: </span>
                          )}
                        {m.first_name} {m.last_name}
                      </span>
                      <StatusBadge
                        member={m}
                        onStatusChange={handleStatusChange}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
