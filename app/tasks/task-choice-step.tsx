"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { useEffect, useRef, useState } from "react";
import { groupedMemberChoices, type MemberChoice } from "@/lib/members/choices";
import { MemberChoiceLabel } from "@/components/member-choice-label";
import { TaskTypeIcon } from "./task-type-icon";

export type TaskChoice = MemberChoice & { type?: string };

export function TaskChoiceStep({
  label,
  items,
  onChoose,
  disabled,
  optionalLabel,
}: {
  label: string;
  items: TaskChoice[];
  onChoose: (value: string | null) => void;
  disabled: boolean;
  optionalLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const memberChoices = items.some((item) => item.exclusionTags !== undefined);
  const groups = memberChoices
    ? groupedMemberChoices(items, search)
    : { regular: items, excluded: [] };
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);
  return (
    <Field>
      <FieldLabel asChild>
        <span>{label}</span>
      </FieldLabel>
      <Command
        shouldFilter={!memberChoices}
        label={label}
        onKeyDownCapture={(event) => {
          // IME confirmation and held Enter must never select or submit.
          if (
            event.key === "Enter" &&
            (event.nativeEvent.isComposing || event.repeat || disabled)
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <CommandInput
          ref={inputRef}
          autoFocus
          value={search}
          onValueChange={setSearch}
          placeholder={`Search ${label.toLowerCase()}…`}
          disabled={disabled}
        />
        <CommandList className="max-h-[min(16rem,35dvh)]">
          <CommandEmpty>No matches found.</CommandEmpty>
          <CommandGroup>
            {optionalLabel && !search.trim() && (
              <CommandItem
                value="__skip__"
                disabled={disabled}
                onSelect={() => onChoose(null)}
              >
                {optionalLabel}
              </CommandItem>
            )}
            {groups.regular.map((item) => (
              <CommandItem
                key={item.value}
                value={item.value}
                keywords={[item.label]}
                disabled={disabled}
                onSelect={() => onChoose(item.value)}
              >
                {item.type && <TaskTypeIcon type={item.type} />}
                <MemberChoiceLabel item={item} />
              </CommandItem>
            ))}
          </CommandGroup>
          {!!groups.excluded.length && (
            <CommandGroup heading="Excluded by default">
              {groups.excluded.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  disabled={disabled}
                  onSelect={() => onChoose(item.value)}
                >
                  <MemberChoiceLabel item={item} />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </Field>
  );
}
