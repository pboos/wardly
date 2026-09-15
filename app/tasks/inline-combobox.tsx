"use client";
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
import { cn } from "@/lib/utils";
import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";

type Item = { value: string; label: string };
export function InlineCombobox({
  items,
  value,
  onChange,
  clearable,
  searchPlaceholder,
  emptyText,
  clearLabel,
  align = "start",
  children,
}: {
  items: Item[];
  value: string | null;
  onChange: (v: string | null) => void;
  clearable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align={align}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && (
                <CommandItem
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  {clearLabel ?? "Clear"}
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={(label) => {
                    const match = items.find((i) => i.label === label);
                    onChange(match ? match.value : item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                  <IconCheck
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
