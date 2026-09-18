"use client";

import { IconPencil } from "@tabler/icons-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagBadge } from "./tag-badge";
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
  const [query, setQuery] = useState("");
  const id = useId();
  const matches = tags.filter((tag) =>
    tag.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Popover onOpenChange={() => setQuery("")}>
      <PopoverTrigger asChild>
        <Button
          variant={iconOnly ? "ghost" : "outline"}
          size={iconOnly ? "icon" : "sm"}
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
        <FieldSet>
          <FieldLegend className="sr-only">{label}</FieldLegend>
          <Field>
            <FieldLabel htmlFor={id}>Search tags</FieldLabel>
            <Input
              id={id}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tags…"
            />
          </Field>
          <FieldGroup className="max-h-64 overflow-y-auto p-1">
            {matches.map((tag) => (
              <Field orientation="horizontal" key={tag.id}>
                <Checkbox
                  id={`${id}-${tag.id}`}
                  checked={selected.includes(tag.id)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange(tag.id, checked === true)
                  }
                />
                <FieldLabel htmlFor={`${id}-${tag.id}`} className="min-w-0">
                  <TagBadge tag={tag} />
                </FieldLabel>
              </Field>
            ))}
            {!matches.length && (
              <p className="text-sm text-muted-foreground">
                {tags.length
                  ? "No matching tags."
                  : "Create tags in Manage tags."}
              </p>
            )}
          </FieldGroup>
        </FieldSet>
      </PopoverContent>
    </Popover>
  );
}
