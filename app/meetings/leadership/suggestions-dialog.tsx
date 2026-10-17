"use client";
import { useState } from "react";
import { CircleHelp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  suggestionsForKind,
  suggestionInstructions,
} from "@/lib/leadership-meetings/suggestions";
import { ruleLabel } from "@/lib/leadership-meetings/calendar";
import type { LeadershipData } from "@/lib/leadership-meetings/loaders";
import type { MeetingKind } from "@/lib/leadership-meetings/types";
import { MarkdownInstructions } from "./markdown-instructions";
export function SuggestionsDialog({
  kind,
  activeSuggestions,
  pending,
  onAdd,
  onClose,
}: {
  kind: MeetingKind;
  activeSuggestions: LeadershipData["activeSuggestions"];
  pending: boolean;
  onAdd: (key?: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function add(key?: string) {
    if (busy || pending) return;
    setBusy(true);
    setStatus("Adding…");
    const saved = await onAdd(key);
    setStatus(
      saved
        ? key
          ? "Agenda item added."
          : "Suggested items added."
        : "Unable to add. Try again to finish the same request.",
    );
    setBusy(false);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Suggested agenda items</DialogTitle>
          <DialogDescription>
            Add topics immediately, then edit their setup on the agenda. Add all
            keeps monthly and annual schedules; the schedule controls which
            meetings each topic appears in.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="outline"
          disabled={busy || pending}
          onClick={() => void add()}
        >
          Add all suggested items
        </Button>
        <div className="flex flex-col gap-1">
          {suggestionsForKind(kind).map((suggestion) => {
            const matches = activeSuggestions.filter(
              (item) => item.key === suggestion.key,
            );
            const active =
              matches.find((item) => item.restoreItemId) ?? matches[0];
            const disabled =
              !suggestion.repeatable && !!active && !active.restoreItemId;
            return (
              <div
                key={suggestion.key}
                className="flex items-center gap-2 border-b py-2"
              >
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {suggestion.title}
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`About ${suggestion.title}`}
                    >
                      <CircleHelp />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-h-[65dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
                    <div className="flex flex-col gap-3">
                      <h3 className="font-medium">{suggestion.title}</h3>
                      <MarkdownInstructions>
                        {suggestionInstructions(suggestion)}
                      </MarkdownInstructions>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.duration} min
                      </p>
                      {active && (
                        <p className="text-sm text-muted-foreground">
                          Your item “{active.title}” uses{" "}
                          {ruleLabel(active.recurrence)}.{" "}
                          {active.restoreItemId
                            ? "Adding restores its saved edits and schedule."
                            : "Edit its setup on the agenda."}
                        </p>
                      )}
                      {disabled && (
                        <p className="text-sm text-muted-foreground">
                          Already scheduled.
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Add ${suggestion.title}`}
                  title={
                    active?.restoreItemId
                      ? "Restore saved item"
                      : disabled
                        ? "Already scheduled"
                        : "Add item"
                  }
                  disabled={busy || pending || disabled}
                  onClick={() => void add(suggestion.key)}
                >
                  <Plus />
                </Button>
              </div>
            );
          })}
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      </DialogContent>
    </Dialog>
  );
}
