"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { groupedMemberChoices, type MemberChoice } from "@/lib/members/choices";
import { MemberChoiceLabel } from "@/components/member-choice-label";
import { cn } from "@/lib/utils";

export type ComboboxItem = MemberChoice & {
  icon?: React.ReactNode;
};

export function Combobox({
  id,
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No items found.",
  clearable = false,
  clearLabel = "Clear",
  className,
  disabled,
  popoverClassName,
  itemLabelClassName,
  onKeyDown,
}: {
  id?: string;
  items: ComboboxItem[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
  clearLabel?: string;
  className?: string;
  disabled?: boolean;
  popoverClassName?: string;
  itemLabelClassName?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const memberChoices = items.some((item) => item.exclusionTags !== undefined);
  const groups = memberChoices
    ? groupedMemberChoices(items, search)
    : { regular: items, excluded: [] };
  const selected = items.find((i) => i.value === value) ?? null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onKeyDown={onKeyDown}
          className={cn(
            "w-full justify-between font-normal data-[placeholder]:text-muted-foreground",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className="truncate">
              {selected ? selected.label : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[var(--radix-popover-trigger-width)] p-0",
          popoverClassName,
        )}
        align="start"
      >
        <Command shouldFilter={!memberChoices}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && (!memberChoices || !search.trim()) && (
                <CommandItem
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  {clearLabel}
                </CommandItem>
              )}
            </CommandGroup>
            {[groups.regular, groups.excluded].map(
              (group, index) =>
                group.length > 0 && (
                  <CommandGroup
                    key={index}
                    heading={index === 1 ? "Excluded by default" : undefined}
                  >
                    {group.map((item) => (
                      <CommandItem
                        key={item.value}
                        value={item.value}
                        keywords={[item.label]}
                        onSelect={() => {
                          onChange(item.value);
                          setOpen(false);
                          setSearch("");
                        }}
                      >
                        {item.icon}
                        <MemberChoiceLabel
                          item={item}
                          labelClassName={itemLabelClassName}
                        />
                        <Check
                          className={cn(
                            "ml-auto",
                            selected?.value === item.value
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ),
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
