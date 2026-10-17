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
  const catalog = suggestionsForKind(kind);
  const rows = catalog.map((suggestion) => ({
    rowKey: suggestion.key,
    suggestion,
  }));
  const prayer = catalog.find((suggestion) => suggestion.key === "prayer");
  if (prayer) rows.push({ rowKey: "final-prayer", suggestion: prayer });
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
          : "Suggested agenda added."
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
          <DialogTitle>Suggested agenda</DialogTitle>
          <DialogDescription>
            Use this suggested schedule or select individual items. Adjust each
            schedule as needed; monthly and annual topics appear only when
            scheduled, rather than at every meeting.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="outline"
          disabled={busy || pending}
          onClick={() => void add()}
        >
          Add entire agenda
        </Button>
        <div className="flex flex-col gap-1">
          {rows.map(({ rowKey, suggestion }) => {
            const matches = activeSuggestions.filter(
              (item) => item.key === suggestion.key,
            );
            const active =
              matches.find((item) => item.restoreItemId) ?? matches[0];
            const disabled =
              !suggestion.repeatable && !!active && !active.restoreItemId;
            return (
              <div
                key={rowKey}
                className="flex items-center gap-2 border-b py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">{suggestion.title}</span>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="w-12 shrink-0 tabular-nums">
                      {suggestion.duration} min
                    </span>
                    <span>{ruleLabel(suggestion.recurrence)}</span>
                  </div>
                </div>
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
