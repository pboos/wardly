"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { SundayMeetingAssignment, SundayMeetingAssignmentInput, SundayMeetingMemberHistory } from "@/lib/sunday-meetings/types";

export function SundayInlinePeopleEditor({
  label, assignments, members, maxPeople, onAdd, onReplace, onRemove,
}: {
  label: string;
  assignments: SundayMeetingAssignment[];
  members: SundayMeetingMemberHistory[];
  maxPeople?: number;
  onAdd: (input: SundayMeetingAssignmentInput) => Promise<unknown>;
  onReplace: (input: SundayMeetingAssignmentInput) => Promise<unknown>;
  onRemove: (assignment: SundayMeetingAssignment) => Promise<unknown>;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const restoreFocusRef = useRef(false);
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    return members.filter((member) => !text || member.name.toLowerCase().includes(text)).slice(0, 8);
  }, [members, query]);

  const activeMember = highlightedIndex === null ? null : matches[highlightedIndex] ?? null;
  const canAddAnother = maxPeople === undefined || assignments.length < maxPeople;
  const canEnter = canAddAnother;

  useEffect(() => {
    if (!isPending && restoreFocusRef.current && inputRef.current && !inputRef.current.disabled) {
      restoreFocusRef.current = false;
      inputRef.current.focus();
    }
  }, [isPending]);

  function mutate(action: () => Promise<unknown>, keepEntryFocused = false) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setQuery("");
        setHighlightedIndex(null);
        const keepOpen = keepEntryFocused && maxPeople !== 1;
        setOpen(keepOpen);
        restoreFocusRef.current = keepOpen;
        router.refresh();
      }
      catch (cause) {
        const message = cause instanceof Error ? cause.message : `Could not update ${label.toLowerCase()}.`;
        setError(message);
        toast.error(message, { action: { label: "Reload", onClick: () => router.refresh() } });
      }
    });
  }
  function submit(input: SundayMeetingAssignmentInput) {
    const shouldReplace = maxPeople !== undefined && assignments.length >= maxPeople;
    mutate(() => (shouldReplace ? onReplace(input) : onAdd(input)), !shouldReplace);
  }
  function remove(assignment: SundayMeetingAssignment) { mutate(() => onRemove(assignment), maxPeople !== 1); }

  return (
    <Field className="gap-1">
      <FieldLabel className="sr-only" htmlFor={canEnter ? inputId : undefined}>{label}</FieldLabel>
      <InputGroup
        className="h-auto min-h-9 min-w-28 flex-wrap gap-1 p-1"
        onClick={(event) => {
          if (canEnter && !(event.target as HTMLElement).closest("button")) {
            event.currentTarget.querySelector("input")?.focus();
          }
        }}
      >
        {assignments.map((assignment) => (
          <Badge
            key={assignment.id}
            variant={assignment.memberId === null ? "destructive" : "secondary"}
            className="h-6 max-w-48"
          >
            <span className="truncate">{assignment.name}</span>
            <Button type="button" variant="ghost" size="icon-xs" disabled={isPending} aria-label={`Remove ${assignment.name} from ${label}`} onClick={() => remove(assignment)}>
              <IconX data-icon="inline-end" />
            </Button>
          </Badge>
        ))}
        {canEnter && <Popover
          open={open && !isPending}
          onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setHighlightedIndex(null); }}
        >
          <PopoverAnchor asChild>
            <InputGroupInput
              className="h-7 min-w-28"
              id={inputId}
              value={query}
              disabled={isPending}
              ref={inputRef}
              placeholder={assignments.length ? undefined : `Assign ${label.toLowerCase()}`}
              aria-label={label}
              aria-controls={`${inputId}-list`}
              aria-activedescendant={activeMember ? `${inputId}-member-${activeMember.id}` : undefined}
              aria-invalid={Boolean(error)}
              aria-errormessage={error ? `${inputId}-error` : undefined}
              onFocus={() => setOpen(true)}
              onChange={(event) => { setQuery(event.target.value); setHighlightedIndex(null); setOpen(true); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (!matches.length) return;
                  setOpen(true);
                  setHighlightedIndex((current) => {
                    if (current === null) return 0;
                    return event.key === "ArrowDown"
                      ? (current + 1) % matches.length
                      : (current - 1 + matches.length) % matches.length;
                  });
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (activeMember) {
                    submit({ memberId: activeMember.id, freeTextName: null });
                  } else {
                    const value = query.trim();
                    if (value) submit({ memberId: null, freeTextName: value });
                  }
                } else if (event.key === "Backspace" && !query && assignments.length) {
                  event.preventDefault(); remove(assignments[assignments.length - 1]);
                }
              }}
            />
          </PopoverAnchor>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
            <Command shouldFilter={false}>
              <CommandList id={`${inputId}-list`}>
                <CommandEmpty>No matching ward member</CommandEmpty>
                {matches.map((member, index) => (
                  <CommandItem
                    key={member.id}
                    id={`${inputId}-member-${member.id}`}
                    value={member.id}
                    data-selected={highlightedIndex === index ? "true" : undefined}
                    className={highlightedIndex === index ? "bg-muted text-foreground" : undefined}
                    onMouseMove={() => setHighlightedIndex(index)}
                    onSelect={() => submit({ memberId: member.id, freeTextName: null })}
                  >
                    {member.name}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>}
      </InputGroup>
      {error && <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </Field>
  );
}
