"use client";

import { useRef, useState } from "react";
import { MemberChoiceLabel } from "@/components/member-choice-label";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  SundayMeetingMemberHistory,
  SundayPersonInput,
} from "@/lib/sunday-meetings/types";
import { sundayPersonChoices } from "./sunday-person-choices";

export function SundayPersonPickerDialog({
  label,
  members,
  pending,
  error,
  roleWithHistory,
  onAdd,
  onCancel,
  onCloseAutoFocus,
}: {
  label: string;
  members: SundayMeetingMemberHistory[];
  pending: boolean;
  error: string | null;
  roleWithHistory?: "speaker" | "prayer" | null;
  onAdd: (person: SundayPersonInput) => void;
  onCancel: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const choices = sundayPersonChoices(members, query);
  const selected =
    choices.find((choice) => choice.value === selectedValue) ?? choices[0];
  const member = selected?.member;
  const history =
    member && roleWithHistory
      ? roleWithHistory === "speaker"
        ? { last: member.lastTalk, next: member.nextTalk }
        : { last: member.lastPrayer, next: member.nextPrayer }
      : null;

  function addSelected() {
    if (selected && !pending) onAdd(selected.person);
  }

  return (
    <DialogContent
      className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle>Add {label.toLowerCase()}</DialogTitle>
        <DialogDescription>
          Search members or type a name. Press Enter to add.
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          addSelected();
        }}
      >
        <Command
          shouldFilter={false}
          value={selected?.value ?? ""}
          onValueChange={setSelectedValue}
          onKeyDownCapture={(event) => {
            if (event.key === "Enter") {
              // Let IME composition finish without accidentally assigning a person.
              event.preventDefault();
              event.stopPropagation();
              if (!event.nativeEvent.isComposing && event.keyCode !== 229)
                addSelected();
            }
          }}
        >
          <CommandInput
            ref={inputRef}
            autoFocus
            aria-label={`${label} name`}
            placeholder="Search members or enter a name…"
            value={query}
            disabled={pending}
            onValueChange={(value) => {
              setQuery(value);
              setSelectedValue("");
            }}
          />
          <CommandList className="max-h-[min(16rem,40svh)]" aria-label="People">
            {[
              choices.filter(
                (choice) =>
                  choice.member && !choice.member.exclusionTags?.length,
              ),
              choices.filter(
                (choice) => !!choice.member?.exclusionTags?.length,
              ),
              choices.filter((choice) => !choice.member),
            ].map(
              (group, index) =>
                group.length > 0 && (
                  <CommandGroup
                    key={index}
                    heading={index === 1 ? "Excluded by default" : undefined}
                  >
                    {group.map((choice) => (
                      <CommandItem
                        key={choice.value}
                        value={choice.value}
                        disabled={pending}
                        onSelect={() => onAdd(choice.person)}
                      >
                        <span className="flex min-w-0 flex-col gap-1 whitespace-normal break-words">
                          <MemberChoiceLabel
                            item={{
                              ...choice,
                              exclusionTags: choice.member?.exclusionTags,
                            }}
                          />
                          {!choice.member && (
                            <span className="text-muted-foreground">
                              Enter to add a non-member
                            </span>
                          )}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ),
            )}
            {!choices.length && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Type a name to add a person.
              </p>
            )}
          </CommandList>
        </Command>
        {history && (
          <p className="text-sm text-muted-foreground">
            Last: {history.last?.date ?? "Never"} · Next:{" "}
            {history.next?.date ?? "None"}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !selected}>
            {pending ? "Adding…" : "Add person"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
