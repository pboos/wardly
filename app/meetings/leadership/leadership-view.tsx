"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppMutation } from "@/lib/actions/use-app-mutation";
import type {
  AgendaRow,
  LeadershipData,
} from "@/lib/leadership-meetings/loaders";
import type {
  AgendaInput,
  ItemOutcome,
  MeetingCommand,
} from "@/lib/leadership-meetings/types";
import { addDays } from "@/lib/leadership-meetings/calendar";
import { changeLeadershipMeeting } from "./actions";
import { AgendaEditor } from "./agenda-editor";
import { AgendaItem } from "./agenda-item";
import { ChoiceField } from "./choice-field";
import { ScheduleDialog } from "./schedule-dialog";
import { SuggestionsDialog } from "./suggestions-dialog";
import { OutcomeDialog } from "./outcome-dialog";
import { TaskDialog } from "./task-dialog";
import { MeetingControlsDialog } from "./meeting-controls-dialog";
import { LegacyImportDialog } from "./legacy-import-dialog";
import { useMeetingTimer } from "./use-meeting-timer";
type Modal =
  | {
      kind:
        | "schedule"
        | "suggestions"
        | "import"
        | "close"
        | "cancel"
        | "reschedule";
    }
  | { kind: "edit"; input: AgendaInput; item?: AgendaRow; requestId: string }
  | { kind: "outcome"; item: AgendaRow; outcome: ItemOutcome }
  | { kind: "task"; item: AgendaRow };
export function LeadershipView({ data }: { data: LeadershipData }) {
  const router = useRouter(),
    mutation = useAppMutation(changeLeadershipMeeting),
    timer = useMeetingTimer();
  const [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState("");
  const meeting = data.meeting,
    readOnly = !meeting || !["planned", "active"].includes(meeting.status);
  const planned = data.items.reduce(
    (sum, item) => sum + item.durationMinutes + timer.extension(item.id),
    0,
  );
  const remainingMs = data.items
    .filter((i) => i.outcome === "pending")
    .reduce(
      (sum, item) =>
        sum + Math.max(0, timer.remainingMs(item.id, item.durationMinutes)),
      0,
    );
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  async function run(command: MeetingCommand, close = true) {
    setError("");
    try {
      await mutation.execute(command);
      if (command.kind === "outcome" || command.kind === "remove")
        timer.finish(command.itemId);
      if (command.kind === "meeting" && command.operation !== "start")
        timer.pause();
      if (close) setModal(null);
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to save. Please try again.";
      setError(message);
      toast.error(message);
    }
  }
  function add(input?: AgendaInput) {
    setModal({
      kind: "edit",
      requestId: crypto.randomUUID(),
      input: input ?? {
        title: "",
        durationMinutes: 5,
        anchorDate: meeting?.date ?? data.today,
        recurrence: { version: 1, kind: "once" },
      },
    });
  }
  const path =
    data.kind === "bishopric"
      ? "/meetings/bishopric"
      : "/meetings/ward-council";
  const finish = timer.runningId
    ? new Intl.DateTimeFormat(undefined, {
        timeZone: data.timeZone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timer.now + remainingMs))
    : null;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <p className="text-sm text-muted-foreground">
            Focused discussions, clear decisions, and shared follow-up.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => setModal({ kind: "schedule" })}
        >
          {data.series ? "Schedule" : "Set up meetings"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!data.series && (
        <Card>
          <CardHeader>
            <CardTitle>Plan your first meeting</CardTitle>
            <CardDescription>
              Choose your schedule to create dated agendas. You decide which
              suggested topics to add.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setModal({ kind: "schedule" })}>
              Choose meeting schedule
            </Button>
          </CardContent>
        </Card>
      )}
      {data.series && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <ChoiceField
              id="meeting-date"
              label="Meeting and history"
              value={meeting?.id ?? ""}
              onChange={(id) =>
                router.push(`${path}?meeting=${encodeURIComponent(id)}`)
              }
              options={data.meetings.map((m) => ({
                value: m.id,
                label: `${m.date} · ${m.start_time} · ${m.status}`,
              }))}
            />
          </div>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() =>
              void run({
                kind: "prepare",
                seriesId: data.series!.id,
                date: addDays(data.meetings.at(-1)?.date ?? data.today, 90),
              })
            }
          >
            Extend schedule
          </Button>
        </div>
      )}
      {meeting && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>
                  {meeting.date} · {meeting.start_time}
                </CardTitle>
                <Badge variant="outline">{meeting.status}</Badge>
              </div>
              <CardDescription>
                {data.timeZone} · Visible to all ward users
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span>
                  <strong>{planned} min</strong> planned
                </span>
                <span>
                  <strong>{remainingMinutes} min</strong> remaining
                </span>
                <span>Target {data.series?.targetMinutes} min</span>
                {finish && <span>Estimated finish {finish}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {meeting.status === "planned" && (
                  <>
                    <Button
                      disabled={mutation.isPending}
                      onClick={() =>
                        void run({
                          kind: "meeting",
                          meetingId: meeting.id,
                          operation: "start",
                        })
                      }
                    >
                      Start meeting
                    </Button>
                    <Button
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => setModal({ kind: "reschedule" })}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={mutation.isPending}
                      onClick={() => setModal({ kind: "cancel" })}
                    >
                      Cancel meeting
                    </Button>
                  </>
                )}
                {!readOnly && (
                  <Button
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => setModal({ kind: "close" })}
                  >
                    Close meeting
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={timer.toggleMuted}
                aria-pressed={timer.muted}
              >
                {timer.muted ? "Unmute alarm" : "Mute alarm"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Timers run only in this window and reset on reload. Decisions,
                agenda changes, and task links are saved.
              </p>
            </CardContent>
          </Card>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => add()} disabled={mutation.isPending}>
                Add item
              </Button>
              <Button
                variant="ghost"
                onClick={() => setModal({ kind: "suggestions" })}
              >
                Suggested items
              </Button>
              {data.kind === "bishopric" && (
                <Button
                  variant="ghost"
                  onClick={() => setModal({ kind: "import" })}
                >
                  Import old agenda
                </Button>
              )}
            </div>
          )}
          {!data.items.length && (
            <Card>
              <CardHeader>
                <CardTitle>No agenda items yet</CardTitle>
                <CardDescription>
                  {readOnly
                    ? "This meeting has no recorded discussions."
                    : "Add your own topic or choose a starter item from the Handbook-based suggestions."}
                </CardDescription>
              </CardHeader>
              {!readOnly && (
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={() => setModal({ kind: "suggestions" })}
                  >
                    Browse suggested items
                  </Button>
                </CardContent>
              )}
            </Card>
          )}
          <div className="flex flex-col gap-3">
            {data.items.map((item) => (
              <AgendaItem
                key={item.id}
                item={item}
                today={data.today}
                onRemove={() => void run({ kind: "remove", itemId: item.id })}
                readOnly={readOnly}
                activeMeeting={meeting.status === "active"}
                pending={mutation.isPending}
                timer={timer}
                onEdit={() =>
                  setModal({
                    kind: "edit",
                    item,
                    requestId: crypto.randomUUID(),
                    input: {
                      title: item.title,
                      durationMinutes: item.durationMinutes,
                      anchorDate: item.anchorDate,
                      recurrence: item.recurrence,
                    },
                  })
                }
                onOutcome={(outcome) =>
                  setModal({ kind: "outcome", item, outcome })
                }
                onTask={() => setModal({ kind: "task", item })}
                onStop={() => void run({ kind: "stop", itemId: item.id })}
                onMove={(direction) =>
                  void run({ kind: "move", itemId: item.id, direction })
                }
              />
            ))}
          </div>
        </>
      )}
      {modal?.kind === "schedule" && (
        <ScheduleDialog
          data={data}
          pending={mutation.isPending}
          onClose={() => setModal(null)}
          onSave={run}
        />
      )}
      {modal?.kind === "suggestions" && (
        <SuggestionsDialog
          kind={data.kind}
          activeSuggestions={data.activeSuggestions}
          pending={mutation.isPending}
          onRestore={(itemId) => void run({ kind: "restore", itemId })}
          onClose={() => setModal(null)}
          onChoose={(s) => {
            let anchorDate = meeting?.date ?? data.today;
            if (s.key === "report") {
              const d = new Date(`${anchorDate}T12:00:00Z`);
              d.setUTCDate(10);
              d.setUTCMonth(Math.ceil(d.getUTCMonth() / 3) * 3);
              if (d.toISOString().slice(0, 10) < anchorDate)
                d.setUTCMonth(d.getUTCMonth() + 3);
              anchorDate = d.toISOString().slice(0, 10);
            }
            add({
              title: s.title,
              durationMinutes: s.duration,
              anchorDate,
              recurrence: s.recurrence,
              suggestionKey: s.key,
            });
          }}
        />
      )}
      {modal?.kind === "edit" && meeting && (
        <AgendaEditor
          initial={modal.input}
          editing={!!modal.item}
          data={data}
          pending={mutation.isPending}
          onClose={() => setModal(null)}
          onSave={(input, scope) =>
            run(
              modal.item
                ? { kind: "edit", itemId: modal.item.id, input, scope }
                : {
                    kind: "add",
                    meetingId: meeting.id,
                    input,
                    requestId: modal.requestId,
                  },
            )
          }
        />
      )}
      {modal?.kind === "outcome" && (
        <OutcomeDialog
          item={modal.item}
          outcome={modal.outcome}
          pending={mutation.isPending}
          onClose={() => setModal(null)}
          onSave={(decision) =>
            run({
              kind: "outcome",
              itemId: modal.item.id,
              outcome: modal.outcome,
              decision,
            })
          }
        />
      )}
      {modal?.kind === "task" && (
        <TaskDialog
          item={modal.item}
          data={data}
          pending={mutation.isPending}
          onClose={() => setModal(null)}
          onSave={run}
        />
      )}
      {meeting &&
        modal &&
        ["close", "cancel", "reschedule"].includes(modal.kind) && (
          <MeetingControlsDialog
            meeting={meeting}
            mode={modal.kind as "close" | "cancel" | "reschedule"}
            pending={mutation.isPending}
            onClose={() => setModal(null)}
            onSave={run}
          />
        )}
      {modal?.kind === "import" && meeting && (
        <LegacyImportDialog
          date={meeting.date}
          pending={mutation.isPending}
          onClose={() => setModal(null)}
          onImport={(items) =>
            run({ kind: "import", meetingId: meeting.id, items })
          }
        />
      )}
    </div>
  );
}
