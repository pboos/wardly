"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveTag as saveTagAction } from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";
import { TAG_COLORS, type MemberTag } from "./tags";
import { TagBadge } from "./tag-badge";

export function TagEditor({
  tag,
  onDone,
}: {
  tag?: MemberTag;
  onDone: () => void;
}) {
  const { execute: saveTag } = useAppMutation(saveTagAction);

  const id = useId();
  const [name, setName] = useState(tag?.name ?? "");
  const [isDefaultExcluded, setIsDefaultExcluded] = useState(
    tag?.isDefaultExcluded ?? false,
  );
  const [color, setColor] = useState(tag?.color ?? "blue");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        startTransition(async () => {
          try {
            await saveTag(tag?.id ?? null, name, color, isDefaultExcluded);
            toast.success(tag ? "Tag updated." : "Tag created.");
            onDone();
          } catch (error) {
            setError(
              error instanceof Error ? error.message : "Could not save tag.",
            );
          }
        });
      }}
    >
      <FieldGroup>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor={id}>Name</FieldLabel>
          <Input
            id={id}
            value={name}
            maxLength={40}
            required
            disabled={pending}
            aria-invalid={!!error}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-color`}>Color</FieldLabel>
          <Select value={color} onValueChange={setColor} disabled={pending}>
            <SelectTrigger id={`${id}-color`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TAG_COLORS.map((value) => (
                  <SelectItem key={value} value={value}>
                    <TagBadge
                      tag={{
                        name: value[0].toUpperCase() + value.slice(1),
                        color: value,
                      }}
                    />
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-excluded`}>Exclude by default</FieldLabel>
          <Switch
            id={`${id}-excluded`}
            checked={isDefaultExcluded}
            onCheckedChange={setIsDefaultExcluded}
            disabled={pending}
            aria-describedby={`${id}-excluded-description`}
          />
          <FieldDescription id={`${id}-excluded-description`}>
            Hide members with this tag by default in the directory. They remain
            searchable at the bottom of member selectors.
          </FieldDescription>
        </Field>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Preview</span>
          <TagBadge tag={{ name: name.trim() || "Tag name", color }} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onDone}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save tag"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
