"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
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
import { MemberTags } from "./member-tags";
import { TagPicker } from "./tag-picker";
import { TagManager } from "./tag-manager";
import { matchesTags, type MemberTag } from "./tags";

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string | null;
  email: string | null;
  is_baptized: boolean;
  is_moved_out: boolean;
  tagIds: string[];
  external_household_uuid: string | null;
  external_household_role: string | null;
};

type StatusScope = "current" | "moved" | "all";

export function MembersList({
  tags,
  members,
  onShownCountChange,
}: {
  tags: MemberTag[];
  members: Member[];
  onShownCountChange?: (count: number) => void;
}) {
  const [nameQuery, setNameQuery] = useState("");
  const [statusScope, setStatusScope] = useState<StatusScope>("current");
  const [included, setIncluded] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const includedIds = included.filter((id) =>
    tags.some((tag) => tag.id === id),
  );
  const excludedIds = excluded.filter((id) =>
    tags.some((tag) => tag.id === id),
  );

  const filtered = useMemo(() => {
    const includedIds = included.filter((id) =>
      tags.some((tag) => tag.id === id),
    );
    const excludedIds = excluded.filter((id) =>
      tags.some((tag) => tag.id === id),
    );
    const q = nameQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (statusScope === "current" && m.is_moved_out) return false;
      if (statusScope === "moved" && !m.is_moved_out) return false;
      if (!matchesTags(m.tagIds, includedIds, excludedIds)) return false;

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
  }, [members, nameQuery, statusScope, included, excluded, tags]);

  const households = useMemo(() => {
    const visibleIds = new Set(filtered.map((member) => member.id));
    return groupMembersByHousehold(members)
      .map((household) => ({
        ...household,
        members: household.members.filter((member) =>
          visibleIds.has(member.id),
        ),
      }))
      .filter((household) => household.members.length > 0);
  }, [members, filtered]);

  useEffect(() => {
    onShownCountChange?.(filtered.length);
  }, [filtered, onShownCountChange]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
          <Label htmlFor="status-scope">Membership</Label>
          <Select
            value={statusScope}
            onValueChange={(v) => setStatusScope(v as StatusScope)}
          >
            <SelectTrigger id="status-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="current">Current members</SelectItem>
                <SelectItem value="moved">Moved out</SelectItem>
                <SelectItem value="all">All members</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TagPicker
          label="Include tags (all)"
          tags={tags}
          selected={includedIds}
          onChange={(id, checked) => {
            setIncluded((ids) =>
              checked ? [...ids, id] : ids.filter((value) => value !== id),
            );
            if (checked)
              setExcluded((ids) => ids.filter((value) => value !== id));
          }}
        />
        <TagPicker
          label="Exclude tags"
          tags={tags}
          selected={excludedIds}
          onChange={(id, checked) => {
            setExcluded((ids) =>
              checked ? [...ids, id] : ids.filter((value) => value !== id),
            );
            if (checked)
              setIncluded((ids) => ids.filter((value) => value !== id));
          }}
        />
        <TagManager tags={tags} />
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
                  <TableHead>Tags</TableHead>
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
                      <TableCell>
                        <MemberTags
                          movedOut={m.is_moved_out}
                          memberId={m.id}
                          name={m.first_name + " " + m.last_name}
                          tagIds={m.tagIds}
                          tags={tags}
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
                        "flex items-center gap-2 px-2 py-2.5",
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
                      <MemberTags
                        compact
                        movedOut={m.is_moved_out}
                        memberId={m.id}
                        name={m.first_name + " " + m.last_name}
                        tagIds={m.tagIds}
                        tags={tags}
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
