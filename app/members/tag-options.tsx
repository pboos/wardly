"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { TagBadge } from "./tag-badge";
import type { MemberTag } from "./tags";

export function TagOptions({
  tags,
  selected,
  onChange,
  label,
  disabled = false,
}: {
  tags: MemberTag[];
  selected: string[];
  onChange: (id: string, checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const id = useId();
  const matches = tags.filter((tag) =>
    tag.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <FieldSet>
      <FieldLegend className="sr-only">{label}</FieldLegend>
      <Field>
        <FieldLabel htmlFor={id}>Search tags</FieldLabel>
        <Input
          disabled={disabled}
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
              onCheckedChange={(checked) => onChange(tag.id, checked === true)}
            />
            <FieldLabel htmlFor={`${id}-${tag.id}`} className="min-w-0">
              <TagBadge tag={tag} />
            </FieldLabel>
          </Field>
        ))}
        {!matches.length && (
          <p className="text-sm text-muted-foreground">
            {tags.length ? "No matching tags." : "Create tags in Manage tags."}
          </p>
        )}
      </FieldGroup>
    </FieldSet>
  );
}
