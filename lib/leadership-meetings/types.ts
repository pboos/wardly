import type { CalendarRule } from "./calendar";
export type MeetingKind = "bishopric" | "ward_council";
export type ItemOutcome = "done" | "continued" | "deferred" | "skipped";
export type AgendaInput = {
  title: string;
  durationMinutes: number;
  anchorDate: string;
  recurrence: CalendarRule;
  suggestionKey?: string;
};
export type MeetingCommand =
  | {
      kind: "initialize";
      meetingKind: MeetingKind;
      anchorDate: string;
      schedule: CalendarRule;
      startTime: string;
      targetMinutes: number;
    }
  | {
      kind: "schedule";
      seriesId: string;
      anchorDate: string;
      schedule: CalendarRule;
      startTime: string;
      targetMinutes: number;
    }
  | { kind: "prepare"; seriesId: string; date: string }
  | {
      kind: "meeting";
      meetingId: string;
      operation: "start" | "cancel" | "close";
      unfinished?: "defer" | "skip";
    }
  | { kind: "reschedule"; meetingId: string; date: string; startTime: string }
  | { kind: "add"; meetingId: string; input: AgendaInput; requestId: string }
  | {
      kind: "edit";
      itemId: string;
      input: AgendaInput;
      scope: "this" | "future";
    }
  | {
      kind: "outcome";
      itemId: string;
      outcome: ItemOutcome;
      decision: string;
      expectedDecision?: string;
    }
  | {
      kind: "notes";
      itemId: string;
      decision: string;
      expectedDecision: string;
    }
  | { kind: "reorder"; meetingId: string; itemIds: string[] }
  | { kind: "save-future-order"; meetingId: string; itemIds: string[] }
  | { kind: "remove"; itemId: string; scope: "this" | "future" }
  | { kind: "restore"; itemId: string }
  | { kind: "stop"; itemId: string }
  | { kind: "move"; itemId: string; direction: -1 | 1 }
  | { kind: "link"; itemId: string; taskId: string }
  | {
      kind: "task";
      itemId: string;
      title: string;
      assignedUserId: string | null;
      requestId: string;
    };
