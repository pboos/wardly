"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppMutation } from "@/lib/actions/use-app-mutation";
import type {
  AgendaRow,
  LeadershipData,
} from "@/lib/leadership-meetings/loaders";
import type {
  AgendaInput,
  MeetingCommand,
} from "@/lib/leadership-meetings/types";
import { addDays } from "@/lib/leadership-meetings/calendar";
import { changeLeadershipMeeting } from "./actions";
import { AgendaEditor } from "./agenda-editor";
import { AgendaItem } from "./agenda-item";
import { ChoiceField } from "./choice-field";
import { ScheduleDialog } from "./schedule-dialog";
import { SuggestionsDialog } from "./suggestions-dialog";
import { MeetingControlsDialog } from "./meeting-controls-dialog";
import { DiscussionDialog } from "./discussion-dialog";
import { QuickAdd } from "./quick-add";
import { useMeetingTimer } from "./use-meeting-timer";
type Modal =
  | {
      kind: "schedule" | "suggestions" | "close" | "cancel" | "reschedule";
    }
  | { kind: "edit"; input: AgendaInput; requestId: string };
export function LeadershipView({ data }: { data: LeadershipData }) {
  const router = useRouter(),
    mutation = useAppMutation(changeLeadershipMeeting),
    timer = useMeetingTimer();
  const [modal, setModal] = useState<Modal | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const meeting = data.meeting,
    readOnly = !meeting || !["planned", "active"].includes(meeting.status);
  const selected = data.items.find((item) => item.id === selectedId);
  const planned = data.items.reduce(
    (sum, item) => sum + item.durationMinutes + timer.extension(item.id),
    0,
  );
  const remainingMs = data.items
    .filter((item) => item.outcome === "pending")
    .reduce(
      (sum, item) =>
        sum + Math.max(0, timer.remainingMs(item.id, item.durationMinutes)),
      0,
    );
  async function run(command: MeetingCommand, close = true): Promise<boolean> {
    setError("");
    try {
      await mutation.execute(command);
      if (command.kind === "outcome" || command.kind === "remove")
        timer.finish(command.itemId);
      if (command.kind === "edit")
        timer.replan(command.itemId, command.input.durationMinutes);
      if (command.kind === "meeting" && command.operation !== "start")
        timer.pause();
      if (close) setModal(null);
      router.refresh();
      return true;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to save. Please try again.";
      setError(message);
      toast.error(message);
      router.refresh();
      return false;
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
  function start(item: AgendaRow) {
    timer.primeSound();
    setSelectedId(item.id);
    if (timer.runningId === item.id) return;
    if (meeting?.status === "planned")
      void run(
        { kind: "meeting", meetingId: meeting.id, operation: "start" },
        false,
      ).then((saved) => {
        if (saved) timer.start(item.id, item.durationMinutes);
      });
    else timer.start(item.id, item.durationMinutes);
  }
  function reorder(itemId: string, target: string | -1 | 1) {
    if (!meeting) return;
    const ids = data.items.map((item) => item.id),
      from = ids.indexOf(itemId);
    const to = typeof target === "number" ? from + target : ids.indexOf(target);
    if (to < 0 || to >= ids.length || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, itemId);
    void run({ kind: "reorder", meetingId: meeting.id, itemIds: ids }, false);
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{data.title}</h1>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={timer.toggleMuted}
            aria-label={timer.muted ? "Unmute alarm" : "Mute alarm"}
            aria-pressed={timer.muted}
          >
            {timer.muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                aria-label="Meeting settings and actions"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() => setModal({ kind: "schedule" })}
                >
                  {data.series ? "Meeting schedule" : "Set up meetings"}
                </DropdownMenuItem>
                {data.series && (
                  <DropdownMenuItem
                    disabled={mutation.isPending}
                    onSelect={() =>
                      void run({
                        kind: "prepare",
                        seriesId: data.series!.id,
                        date: addDays(
                          data.meetings.at(-1)?.date ?? data.today,
                          90,
                        ),
                      })
                    }
                  >
                    Extend schedule
                  </DropdownMenuItem>
                )}
                {meeting?.status === "planned" && (
                  <>
                    <DropdownMenuItem
                      onSelect={() => setModal({ kind: "reschedule" })}
                    >
                      Reschedule meeting
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setModal({ kind: "cancel" })}
                    >
                      Cancel meeting
                    </DropdownMenuItem>
                  </>
                )}
                {meeting && !readOnly && (
                  <DropdownMenuItem
                    onSelect={() => setModal({ kind: "close" })}
                  >
                    Close meeting
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={timer.testSound}>
                  Test alarm sound
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!data.series && (
        <Button
          className="self-start"
          onClick={() => setModal({ kind: "schedule" })}
        >
          Choose meeting schedule
        </Button>
      )}
      {data.series && (
        <ChoiceField
          id="meeting-date"
          label="Meeting and history"
          value={meeting?.id ?? ""}
          onChange={(id) =>
            router.push(`${path}?meeting=${encodeURIComponent(id)}`)
          }
          options={data.meetings.map((row) => ({
            value: row.id,
            label: `${row.date} · ${row.start_time} · ${row.status}`,
          }))}
        />
      )}
      {meeting && (
        <>
          {!readOnly && (
            <div className="flex flex-col gap-2">
              <QuickAdd
                pending={mutation.isPending}
                onAdd={(title, durationMinutes, requestId) =>
                  run({
                    kind: "add",
                    meetingId: meeting.id,
                    requestId,
                    input: {
                      title,
                      durationMinutes,
                      anchorDate: meeting.date,
                      recurrence: { version: 1, kind: "once" },
                    },
                  })
                }
              />
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModal({ kind: "suggestions" })}
                >
                  Suggested items
                </Button>
                <Button variant="ghost" size="sm" onClick={() => add()}>
                  Add recurring item
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={
                    mutation.isPending ||
                    data.items.filter((item) => item.repeating).length < 2
                  }
                  onClick={async () => {
                    if (
                      await run(
                        {
                          kind: "save-future-order",
                          meetingId: meeting.id,
                          itemIds: data.items.map((item) => item.id),
                        },
                        false,
                      )
                    )
                      toast.success(
                        "Recurring order saved for future planned meetings. One-time items and history keep their places.",
                      );
                  }}
                >
                  Use this order for future meetings
                </Button>
              </div>
            </div>
          )}
          {!data.items.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {readOnly
                ? "No recorded discussions."
                : "Add a topic to begin your agenda."}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {data.items.map((item) => (
              <AgendaItem
                key={item.id}
                item={item}
                today={data.today}
                readOnly={readOnly}
                pending={mutation.isPending}
                timer={timer}
                onOpen={() => setSelectedId(item.id)}
                onStart={() => start(item)}
                onReorder={(target) => reorder(item.id, target)}
                onComplete={() =>
                  void run(
                    {
                      kind: "outcome",
                      itemId: item.id,
                      outcome: "done",
                      decision: item.decision,
                      expectedDecision: item.decision,
                    },
                    false,
                  )
                }
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{planned} min</strong> planned
            </span>
            <span>
              <strong className="text-foreground">
                {Math.ceil(remainingMs / 60000)} min
              </strong>{" "}
              remaining
            </span>
            {finish && <span>Finish around {finish}</span>}
          </div>
        </>
      )}
      {selected && (
        <DiscussionDialog
          key={selected.id}
          item={selected}
          data={data}
          readOnly={readOnly}
          pending={mutation.isPending}
          timer={timer}
          onStart={() => start(selected)}
          onSave={(command) => run(command, false)}
          onClose={() => setSelectedId(null)}
          saveError={error}
        />
      )}
      {modal?.kind === "schedule" && (
        <ScheduleDialog
          data={data}
          pending={mutation.isPending}
          onClose={() => setModal(null)}
          onSave={async (command) => {
            await run(command);
          }}
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
          editing={false}
          data={data}
          pending={mutation.isPending}
          onClose={() => setModal(null)}
          onSave={async (input) => {
            await run({
              kind: "add",
              meetingId: meeting.id,
              input,
              requestId: modal.requestId,
            });
          }}
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
            onSave={async (command) => {
              await run(command);
            }}
          />
        )}
    </div>
  );
}
