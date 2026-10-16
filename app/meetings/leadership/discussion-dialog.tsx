"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type {
  AgendaRow,
  LeadershipData,
} from "@/lib/leadership-meetings/loaders";
import type {
  AgendaInput,
  ItemOutcome,
  MeetingCommand,
} from "@/lib/leadership-meetings/types";
import type { MeetingTimer } from "./use-meeting-timer";
import { AgendaSetupFields } from "./agenda-setup-fields";
import { DiscussionTasksForm } from "./discussion-tasks-form";
import { DiscussionTimer } from "./discussion-timer";
export function DiscussionDialog({
  item,
  data,
  readOnly,
  pending,
  timer,
  onStart,
  onSave,
  onClose,
  saveError,
}: {
  item: AgendaRow;
  data: LeadershipData;
  readOnly: boolean;
  pending: boolean;
  timer: MeetingTimer;
  onStart: () => void;
  onSave: (command: MeetingCommand) => Promise<boolean>;
  onClose: () => void;
  saveError: string;
}) {
  const [notes, setNotes] = useState(item.decision);
  const [savedNotes, setSavedNotes] = useState(item.decision);
  const [setupOpen, setSetupOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [draft, setDraft] = useState<AgendaInput>(() => ({
    title: item.title,
    durationMinutes: item.durationMinutes,
    recurrence: item.recurrence,
    anchorDate: item.anchorDate,
  }));
  const [scope, setScope] = useState<"this" | "future">("this");
  const [error, setError] = useState("");
  const dirty = notes !== savedNotes;
  const editableSetup = !readOnly && item.outcome === "pending";
  async function saveNotes() {
    if (!dirty) return true;
    setError("");
    const saved = await onSave({
      kind: "notes",
      itemId: item.id,
      decision: notes,
      expectedDecision: savedNotes,
    });
    if (saved) {
      setSavedNotes(notes.trim());
      setNotes((current) => (current === notes ? notes.trim() : current));
    } else
      setError(
        "Your notes have not been saved. Keep this dialog open and review the error above.",
      );
    return saved;
  }
  async function close() {
    if (!pending && (await saveNotes())) onClose();
  }
  async function outcome(value: ItemOutcome) {
    setError("");
    if (
      await onSave({
        kind: "outcome",
        itemId: item.id,
        outcome: value,
        decision: notes,
        expectedDecision: savedNotes,
      })
    )
      onClose();
    else
      setError(
        "The discussion could not be finished. Your notes are still here.",
      );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-xl"
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{item.title}</DialogTitle>
          <DialogDescription>
            {item.durationMinutes} min
            {item.outcome !== "pending" ? ` · ${item.outcome}` : ""}
            {readOnly ? " · Historical discussion" : ""}
          </DialogDescription>
        </DialogHeader>
        {editableSetup && (
          <DiscussionTimer
            item={item}
            timer={timer}
            pending={pending}
            onStart={onStart}
          />
        )}
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="discussion-notes">Discussion notes</FieldLabel>
            <Textarea
              id="discussion-notes"
              disabled={pending}
              rows={5}
              maxLength={4000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <span role="status" className="text-xs text-muted-foreground">
                {pending ? "Saving…" : dirty ? "Unsaved notes" : "Notes saved"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || !dirty}
                onClick={() => void saveNotes()}
              >
                Save notes
              </Button>
            </div>
          </Field>
        </FieldGroup>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">
              Follow-up tasks ({item.tasks.length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={tasksOpen}
              onClick={() => setTasksOpen(!tasksOpen)}
            >
              {tasksOpen ? (
                <ChevronUp data-icon="inline-start" />
              ) : (
                <ChevronDown data-icon="inline-start" />
              )}
              Create or link task
            </Button>
          </div>
          {!!item.tasks.length && (
            <ul className="flex flex-col gap-2">
              {item.tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <Link href="/tasks" className="text-primary underline">
                    {task.title}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">
                    {task.completed ? "Completed" : "Open"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {tasksOpen && (
            <DiscussionTasksForm
              item={item}
              data={data}
              pending={pending}
              onSave={onSave}
            />
          )}
        </div>
        {editableSetup && (
          <>
            <Separator />
            <div className="flex flex-col gap-4">
              <Button
                variant="ghost"
                className="self-start"
                aria-expanded={setupOpen}
                onClick={() => setSetupOpen(!setupOpen)}
              >
                <Settings2 data-icon="inline-start" />
                {setupOpen ? "Hide setup" : "Edit setup"}
              </Button>
              {setupOpen && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onSave({
                      kind: "edit",
                      itemId: item.id,
                      input: draft,
                      scope,
                    }).then((saved) => {
                      if (saved) setSetupOpen(false);
                    });
                  }}
                >
                  <FieldSet disabled={pending}>
                    <AgendaSetupFields
                      draft={draft}
                      setDraft={setDraft}
                      scope={scope}
                      setScope={setScope}
                      editing
                      data={data}
                    />
                    <Button type="submit" disabled={pending}>
                      Save setup
                    </Button>
                  </FieldSet>
                </form>
              )}
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending} onClick={() => void outcome("done")}>
                Done
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void outcome("continued")}
              >
                Continue next meeting
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void outcome("deferred")}
              >
                Move to next meeting
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void outcome("skipped")}
              >
                Skip occurrence
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={async () => {
                  if (
                    (await saveNotes()) &&
                    (await onSave({ kind: "remove", itemId: item.id }))
                  )
                    onClose();
                }}
              >
                Remove from agenda
              </Button>
              {item.repeating && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => void onSave({ kind: "stop", itemId: item.id })}
                >
                  Stop repeating
                </Button>
              )}
            </div>
          </>
        )}
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => void close()}
        >
          Close discussion
        </Button>
        {dirty && (
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Discard unsaved notes and close
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
