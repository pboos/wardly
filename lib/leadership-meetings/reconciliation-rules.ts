import type { Prisma } from "@/generated/prisma/client";
import { assignMeeting, datesBetween, type CalendarRule, type ScheduledDate } from "./calendar";

type TemplateDates = Pick<Prisma.meeting_agenda_templateGetPayload<object>,
  "anchor_date" | "after_date" | "after_meeting_date">;
export type AgendaDue = { key: string; date: string; meetingId: string | null };

export function recurrenceDues({
  rule, template, meetings, today, through,
}: {
  rule: CalendarRule;
  template: TemplateDates;
  meetings: ScheduledDate[];
  today: string;
  through: string;
}): AgendaDue[] {
  const dues = rule.kind === "every_meeting"
    ? meetings.filter((meeting) =>
        meeting.date >= template.anchor_date && meeting.date >= today &&
        meeting.date <= through && !["cancelled", "superseded"].includes(meeting.status),
      ).map((meeting) => ({ key: meeting.id, date: meeting.date, meetingId: meeting.id }))
    : datesBetween(rule, template.anchor_date, template.anchor_date, through)
        .map((date) => ({ key: date, date, meetingId: null }));
  return dues.filter((due) => !template.after_date || due.date > template.after_date);
}

export function targetForDue({
  due, template, meetings, today, held,
}: {
  due: AgendaDue;
  template: TemplateDates;
  meetings: ScheduledDate[];
  today: string;
  held: ReadonlySet<string>;
}): ScheduledDate | undefined {
  if (due.meetingId)
    return meetings.find((meeting) =>
      meeting.id === due.meetingId && meeting.status === "planned" && !held.has(meeting.id),
    );
  return assignMeeting(due.date, meetings
    .filter((meeting) => !template.after_meeting_date || meeting.date > template.after_meeting_date)
    .map((meeting) =>
      (meeting.date < today || held.has(meeting.id)) && meeting.status === "planned"
        ? { ...meeting, status: "past" }
        : meeting,
    ));
}
