"use client";
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
import type { StateGroup, TaskState, TaskType } from "@/lib/tasks/types";
import { findTaskState } from "@/lib/tasks/utils";
import { cn } from "@/lib/utils";
import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { TaskStateIcon } from "./status-progress-icon";
const STATE_GROUP_LABELS: Record<StateGroup, string> = {
  not_started: "Not started",
  active: "Active",
  closed: "Closed",
};
const STATE_GROUP_ORDER: StateGroup[] = ["not_started", "active", "closed"];
export function StatePicker({
  typeDef,
  value,
  onSelect,
  showLabel = false,
  align = "start",
  buttonClassName,
}: {
  typeDef: TaskType;
  value: string;
  onSelect: (
    toState: string,
    isClosed: boolean,
    assignToUserId: string | null,
  ) => void;
  showLabel?: boolean;
  align?: "start" | "center" | "end";
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = findTaskState(typeDef, value);
  if (!current) return null;

  const grouped: Record<StateGroup, TaskState[]> = {
    not_started: [],
    active: [],
    closed: [],
  };
  for (const s of typeDef.states) {
    grouped[s.state_group].push(s);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {showLabel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start gap-2 font-normal",
              buttonClassName,
            )}
            aria-label="Change status"
          >
            <TaskStateIcon stateDef={current} size={16} />
            <span className="truncate">{current.label}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(buttonClassName)}
            aria-label="Change status"
          >
            <TaskStateIcon stateDef={current} size={20} />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align={align}>
        <Command>
          <CommandInput placeholder="Search states…" />
          <CommandList>
            <CommandEmpty>No states found.</CommandEmpty>
            {STATE_GROUP_ORDER.filter((g) => grouped[g].length > 0).map((g) => (
              <CommandGroup key={g} heading={STATE_GROUP_LABELS[g]}>
                {grouped[g].map((s) => (
                  <CommandItem
                    key={s.state}
                    value={s.label}
                    onSelect={() => {
                      onSelect(
                        s.state,
                        s.state_group === "closed",
                        s.assign_to_user_id,
                      );
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <TaskStateIcon stateDef={s} size={16} />
                    <span>{s.label}</span>
                    <IconCheck
                      className={cn(
                        "ml-auto",
                        s.state === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
