"use client";
import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
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
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

type UserItem = { value: string; label: string };
export function UserAssignee({
  items,
  value,
  name,
  onChange,
  disabled = false,
  label,
}: {
  items: UserItem[];
  value: string | null;
  name?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const assigneeName =
    name ?? items.find((item) => item.value === value)?.label ?? "?";
  function select(value: string | null) {
    if (disabled) return;
    onChange(value);
    setOpen(false);
  }
  return (
    <Popover open={open} onOpenChange={(next) => setOpen(next && !disabled)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label={label}
          title={value ? assigneeName : "No assignee"}
          className={cn(
            "size-6 rounded-full p-0",
            !value && "border border-dashed border-border text-muted-foreground",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {value ? <UserAvatar name={assigneeName} size="sm" /> : "+"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 max-w-[calc(100vw-2rem)] p-0"
        align="center"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Command>
          <CommandInput
            placeholder="Search users…"
            aria-label="Search users"
            disabled={disabled}
          />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                disabled={disabled}
                onSelect={() => select(null)}
                className="text-muted-foreground"
              >
                No assignee
              </CommandItem>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  keywords={[item.label]}
                  disabled={disabled}
                  onSelect={() => select(item.value)}
                >
                  {item.label}
                  <IconCheck
                    className={cn(
                      "ml-auto",
                      value === item.value ? "opacity-100" : "opacity-0",
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
