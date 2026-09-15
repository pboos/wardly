"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  SundayMeetingItem,
  SundayMeetingMemberHistory,
  SundayPersonInput,
} from "@/lib/sunday-meetings/types";
import { SundayPersonChip } from "./sunday-person-chip";
import { SundayPersonPickerDialog } from "./sunday-person-picker-dialog";

/** One shared display and modal for all Sunday person assignments. */
export function SundayPeoplePicker({
  label,
  items,
  members,
  maxPeople,
  compact = false,
  layout = "horizontal",
  roleWithHistory,
  renderDetails,
  onAdd,
  onRemove,
}: {
  label: string;
  items: SundayMeetingItem[];
  members: SundayMeetingMemberHistory[];
  maxPeople?: number;
  compact?: boolean;
  layout?: "horizontal" | "vertical";
  roleWithHistory?: "speaker" | "prayer" | null;
  renderDetails?: (item: SundayMeetingItem) => ReactNode;
  onAdd: (person: SundayPersonInput) => Promise<unknown>;
  onRemove: (item: SundayMeetingItem) => Promise<unknown>;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const people = items.filter((item) => item.personNameResolved);
  const canAdd = maxPeople === undefined || people.length < maxPeople;

  function changeOpen(value: boolean) {
    openRef.current = value;
    setOpen(value);
    setError(null);
  }

  function mutate(action: () => Promise<unknown>, adding = false) {
    if (pending || busy.current) return;
    busy.current = true;
    setError(null);
    startTransition(async () => {
      try {
        await action();
        if (adding) changeOpen(false);
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : `Could not update ${label.toLowerCase()}.`,
        );
      } finally {
        busy.current = false;
      }
    });
  }

  const addButton = canAdd && (
    <DialogTrigger asChild>
      <Button
        ref={addRef}
        type="button"
        variant="ghost"
        size={people.length || compact ? "icon-sm" : "sm"}
        className="shrink-0"
        disabled={pending}
        aria-label={`Add ${label.toLowerCase()}`}
      >
        <IconPlus
          data-icon={people.length || compact ? undefined : "inline-start"}
        />
        {!people.length && !compact && `Add ${label.toLowerCase()}`}
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <div
        ref={rootRef}
        role="group"
        aria-label={label}
        aria-busy={pending}
        tabIndex={-1}
        className="min-w-0"
      >
        <ul
          className={cn(
            "flex gap-1",
            layout === "vertical"
              ? "flex-col items-start"
              : "flex-wrap items-center",
          )}
        >
          {people.map((item, index) => (
            <li key={item.id} className="flex max-w-full flex-col gap-1">
              <div className="flex max-w-full items-center gap-1">
                <SundayPersonChip
                  item={item}
                  label={label}
                  pending={pending}
                  onEdit={maxPeople === 1 ? () => changeOpen(true) : undefined}
                  onRemove={() => mutate(() => onRemove(item))}
                />
                {index === people.length - 1 && addButton}
              </div>
              {renderDetails?.(item)}
            </li>
          ))}
          {!people.length && <li>{addButton}</li>}
        </ul>
        {!open && error && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      {open && (
        <SundayPersonPickerDialog
          label={label}
          members={members}
          pending={pending}
          error={error}
          roleWithHistory={roleWithHistory}
          onAdd={(person) => mutate(() => onAdd(person), true)}
          onCancel={() => changeOpen(false)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // A previous closing modal must not steal focus after a quick reopen.
            if (!openRef.current) (addRef.current ?? rootRef.current)?.focus();
          }}
        />
      )}
    </Dialog>
  );
}
