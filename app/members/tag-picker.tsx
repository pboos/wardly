"use client";

import { IconPencil } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagOptions } from "./tag-options";
import type { MemberTag } from "./tags";

export function TagPicker({
  tags,
  selected,
  onChange,
  label,
  iconOnly = false,
  disabled = false,
}: {
  tags: MemberTag[];
  selected: string[];
  onChange: (id: string, checked: boolean) => void;
  label: string;
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={iconOnly ? "ghost" : "outline"}
          size={iconOnly ? "icon" : "sm"}
          disabled={disabled}
          aria-label={label}
          title={iconOnly ? label : undefined}
        >
          {iconOnly ? (
            <IconPencil />
          ) : (
            <>
              {label}
              {selected.length > 0 && ` (${selected.length})`}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
        <TagOptions
          tags={tags}
          selected={selected}
          onChange={onChange}
          label={label}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}
