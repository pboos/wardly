"use client";

import { useState } from "react";
import { IconSelector } from "@tabler/icons-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { SundayMeetingMemberHistory } from "@/lib/sunday-meetings/types";
import { SundayAssignmentHistoryList } from "./sunday-assignment-history-list";

export function SundayAssignmentHistoryDialog({
  members,
  today,
}: {
  members: SundayMeetingMemberHistory[];
  today: string;
}) {
  const [includeNeverAssigned, setIncludeNeverAssigned] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const eligibleMembers = members
    .filter((member) => !member.is_moved_out && !member.exclusionTags?.length)
    .sort((left, right) =>
      left.name.localeCompare(right.name, "en") ||
      left.id.localeCompare(right.id, "en"),
    );
  const selectedMember = eligibleMembers.find(
    (member) => member.id === selectedMemberId,
  );
  const displayedMembers =
    selectedMemberId === null
      ? eligibleMembers
      : eligibleMembers.filter((member) => member.id === selectedMemberId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Assignment history</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Assignment history</DialogTitle>
          <DialogDescription>
            Most recent assignment, oldest first. Includes future bookings. Current
            members only. Members with an Exclude by default tag are hidden.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="history-member">Member</FieldLabel>
          <Popover
            modal
            open={memberPickerOpen}
            onOpenChange={setMemberPickerOpen}
          >
            <PopoverTrigger asChild>
              <Button
                id="history-member"
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={memberPickerOpen}
                className="w-full justify-between"
              >
                <span className="truncate">
                  {selectedMember?.name ?? "All members"}
                </span>
                <IconSelector data-icon="inline-end" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
            >
              <Command>
                <CommandInput
                  aria-label="Search members"
                  placeholder="Search members…"
                />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all-members"
                      keywords={["All members"]}
                      data-checked={selectedMemberId === null}
                      onSelect={() => {
                        setSelectedMemberId(null);
                        setMemberPickerOpen(false);
                      }}
                    >
                      All members
                    </CommandItem>
                    {eligibleMembers.map((member) => (
                      <CommandItem
                        key={member.id}
                        value={member.id}
                        keywords={[member.name]}
                        data-checked={member.id === selectedMemberId}
                        onSelect={() => {
                          setSelectedMemberId(member.id);
                          setMemberPickerOpen(false);
                        }}
                      >
                        <span className="min-w-0 break-words">{member.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>
        <Field orientation="horizontal">
          <Switch
            id="include-never-assigned"
            checked={includeNeverAssigned}
            onCheckedChange={setIncludeNeverAssigned}
          />
          <FieldLabel htmlFor="include-never-assigned">
            Include members with no recorded assignment in each list
          </FieldLabel>
        </Field>
        <div className="grid min-w-0 gap-6 sm:grid-cols-2">
          <SundayAssignmentHistoryList
            members={displayedMembers}
            kind="prayer"
            includeNeverAssigned={includeNeverAssigned}
            today={today}
          />
          <SundayAssignmentHistoryList
            members={displayedMembers}
            kind="talk"
            includeNeverAssigned={includeNeverAssigned}
            today={today}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
