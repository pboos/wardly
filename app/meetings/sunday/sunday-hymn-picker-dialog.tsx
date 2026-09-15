"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hymnChoices } from "@/lib/sunday-meetings/hymns";
import { useSundayHymns } from "./sunday-hymn-provider";
import type { SundayHymnSlotInput } from "./sunday-hymn-picker";

export function SundayHymnPickerDialog({
  initialNumber,
  initialText,
  allowMusicalNumber,
  canClear,
  pending,
  error,
  onSave,
  onCancel,
}: {
  initialNumber?: number;
  initialText?: string;
  allowMusicalNumber: boolean;
  canClear: boolean;
  pending: boolean;
  error: string | null;
  onSave: (input: SundayHymnSlotInput) => void;
  onCancel: () => void;
}) {
  const { hymns, lastSung } = useSundayHymns();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(
    initialText ?? initialNumber?.toString() ?? "",
  );
  const [selectedValue, setSelectedValue] = useState("");
  const choices = hymnChoices(hymns, query);
  const musical = Boolean(query.trim()) && allowMusicalNumber;
  // Hymn-only fields still allow numbers missing from the catalog.
  const number = /^\d+$/.test(query.trim()) ? Number(query.trim()) : 0;
  const manual =
    !allowMusicalNumber &&
    number >= 1 &&
    number <= 9999 &&
    !choices.some((hymn) => hymn.number === number);
  const values = [
    ...(manual ? [String(number)] : []),
    ...choices.map((hymn) => String(hymn.number)),
    ...(musical ? ["musical"] : []),
  ];
  const selected = values.includes(selectedValue) ? selectedValue : values[0];
  function save(value = selected) {
    if (!value || pending) return;
    onSave(
      value === "musical"
        ? {
            type: "musical_number",
            metadata: null,
            content: query.trim(),
            person: null,
          }
        : {
            type: "hymn",
            metadata: { hymnNumber: Number(value) },
            content: null,
            person: null,
          },
    );
  }
  return (
    <DialogContent
      className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }}
    >
      <DialogHeader>
        <DialogTitle>Select hymn</DialogTitle>
        <DialogDescription>
          Enter a hymn number. Press Enter to select.
          {allowMusicalNumber &&
            " Or type musical-number details and performer names. Choose the last suggestion to save your text as a musical number."}
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Command
          shouldFilter={false}
          value={selected ?? ""}
          onValueChange={setSelectedValue}
          onKeyDownCapture={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              if (!event.nativeEvent.isComposing && event.keyCode !== 229)
                save();
            }
          }}
        >
          <CommandInput
            ref={inputRef}
            aria-label={
              allowMusicalNumber
                ? "Hymn number or musical number"
                : "Hymn number"
            }
            placeholder={
              allowMusicalNumber
                ? "Hymn number or musical-number details…"
                : "Enter hymn number…"
            }
            value={query}
            disabled={pending}
            onValueChange={(value) => {
              setQuery(value);
              setSelectedValue("");
            }}
          />
          <CommandList className="max-h-[min(16rem,40svh)]" aria-label="Hymns">
            <CommandGroup>
              {manual && (
                <CommandItem
                  value={String(number)}
                  disabled={pending}
                  onSelect={() => save(String(number))}
                >
                  Hymn {number} — title unavailable
                </CommandItem>
              )}
              {choices.map((hymn) => (
                <CommandItem
                  key={hymn.number}
                  value={String(hymn.number)}
                  disabled={pending}
                  onSelect={() => save(String(hymn.number))}
                >
                  <span className="whitespace-normal break-words">
                    {hymn.number} · {hymn.title}
                  </span>
                </CommandItem>
              ))}
              {musical && (
                <CommandItem
                  value="musical"
                  disabled={pending}
                  onSelect={() => save("musical")}
                >
                  <span className="flex min-w-0 flex-col gap-1 whitespace-normal break-words">
                    <span>{query.trim()}</span>
                    <span className="text-muted-foreground">
                      Enter to add a musical number
                    </span>
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
            {!values.length && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {allowMusicalNumber
                  ? "Enter a hymn number or musical-number details."
                  : "Enter a whole hymn number from 1 to 9999."}
              </p>
            )}
          </CommandList>
        </Command>
        {selected && selected !== "musical" && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Last sung: {lastSung[Number(selected)] ?? "Never recorded"}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          {canClear && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                onSave({
                  type: "hymn",
                  metadata: null,
                  content: null,
                  person: null,
                })
              }
            >
              Clear
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !selected}>
            {pending
              ? "Saving…"
              : selected === "musical"
                ? "Add musical number"
                : "Select hymn"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
