"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SUGGESTIONS,
  sourceUrl,
  type Suggestion,
} from "@/lib/leadership-meetings/suggestions";
import { ruleLabel } from "@/lib/leadership-meetings/calendar";
import type { LeadershipData } from "@/lib/leadership-meetings/loaders";
import type { MeetingKind } from "@/lib/leadership-meetings/types";
export function SuggestionsDialog({
  kind,
  activeSuggestions,
  pending,
  onRestore,
  onChoose,
  onClose,
}: {
  kind: MeetingKind;
  activeSuggestions: LeadershipData["activeSuggestions"];
  pending: boolean;
  onRestore: (itemId: string) => void;
  onChoose: (suggestion: Suggestion) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Suggested agenda items</DialogTitle>
          <DialogDescription>
            Choose only what helps your meeting. Frequencies marked “Suggested
            rhythm” are editable suggestions, not Handbook requirements. Removed
            suggestions remain available here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {SUGGESTIONS.filter((s) => s.kinds.includes(kind)).map((s) => {
            const active = activeSuggestions.find((item) => item.key === s.key);
            return (
              <section
                key={s.key}
                className="flex flex-col gap-2 border-b pb-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{s.title}</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || (!!active && !active.restoreItemId)}
                    onClick={() =>
                      active?.restoreItemId
                        ? onRestore(active.restoreItemId)
                        : onChoose(s)
                    }
                  >
                    {active?.restoreItemId
                      ? "Restore item"
                      : active?.onAgenda
                        ? "On this agenda"
                        : active
                          ? "Already scheduled"
                          : "Choose"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{s.detail}</p>
                {active && (
                  <p className="text-sm text-muted-foreground">
                    Your existing item “{active.title}” uses{" "}
                    {ruleLabel(active.recurrence)} and {active.durationMinutes}{" "}
                    minutes.{" "}
                    {active.restoreItemId
                      ? "Restore keeps your edits and schedule. Edit it on the agenda to change them."
                      : "Edit the existing agenda item to change its wording, duration, or recurrence."}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{ruleLabel(s.recurrence)}</Badge>
                  <Badge variant="outline">{s.frequency}</Badge>
                  <span className="text-sm">{s.duration} min</span>
                </div>
                <a
                  className="text-sm text-primary underline"
                  href={sourceUrl(s)}
                  target="_blank"
                  rel="noreferrer"
                >
                  General Handbook {s.reference}
                </a>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
