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
import { TaskTypeIcon } from "./task-type-icon";

export type TaskChoice = { value: string; label: string; type?: string };

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
            {items.map((item) => (
              <CommandItem
                key={item.value}
                value={item.value}
                keywords={[item.label]}
                disabled={disabled}
                onSelect={() => onChoose(item.value)}
              >
                {item.type && <TaskTypeIcon type={item.type} />}
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Field>
  );
}
