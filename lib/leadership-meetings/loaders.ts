import "server-only";
import { topicId } from "./topics";
import { canonicalSuggestionKey, SUGGESTIONS } from "./suggestions";
import { suggestionState } from "./suggestion-state";
import { prisma } from "@/lib/prisma";
import { localToday, parseRule } from "./calendar";
import type { MeetingKind } from "./types";
export async function loadLeadershipMeeting(
  wardId: string,
  kind: MeetingKind,
  selected?: string,
) {
  const ward = await prisma.ward.findUniqueOrThrow({
    where: { id: wardId },
    select: { type: true, time_zone: true },
  });
  const today = localToday(ward.time_zone);
  const series = await prisma.leadership_meeting_series.findUnique({
    where: { ward_id_kind: { ward_id: wardId, kind } },
  });
  const meetings = series
    ? await prisma.leadership_meeting.findMany({
        where: { series_id: series.id, status: { not: "superseded" } },
        orderBy: { date: "asc" },
        select: { id: true, date: true, start_time: true, status: true },
      })
    : [];
  const meeting =
    meetings.find((m) => m.id === selected) ??
    meetings.find((m) => m.status === "active") ??
    meetings.find((m) => m.date >= today && m.status === "planned") ??
    meetings.at(-1) ??
    null;
  const rows = meeting
    ? await prisma.meeting_agenda_item.findMany({
        where: { meeting_id: meeting.id },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        include: {
          occurrences: {
            include: { occurrence: { include: { template: true } } },
          },
          tasks: {
            include: {
              task: { select: { id: true, title: true, completed_at: true } },
            },
          },
        },
      })
    : [];
  const visibleRows = rows.filter((row) => row.outcome !== "removed");
  const topicIds = [...new Set(visibleRows.flatMap((row) =>
    row.occurrences.length ? [topicId(row)] : [],
  ))];
  const topics = await prisma.meeting_agenda_topic.findMany({
    where: { id: { in: topicIds } },
    select: { id: true, notes: true },
  });
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const items = visibleRows
    .map((row) => {
      const sharedNotes = row.occurrences.length
        ? topicsById.get(topicId(row))?.notes ?? ""
        : "";
      const template =
        row.occurrences.find((o) => !o.occurrence.template.archived)?.occurrence
          .template ?? row.occurrences[0]?.occurrence.template;
      return {
        id: row.id,
        title: row.title,
        instructions: row.instructions,
        assignedUserId: row.assigned_user_id,
        assignmentOverridden: row.assignment_overridden,
        defaultAssignedUserId: template?.default_assigned_user_id ?? null,
        durationMinutes: row.duration_minutes,
        outcome: row.outcome,
        decision: row.decision,
        sharedNotes,
        hasSharedNotes: !!sharedNotes || row.occurrences.some((link) =>
          parseRule(JSON.parse(link.occurrence.template.recurrence)).kind !== "once",
        ),
        predecessorId: row.predecessor_id,
        dueDates: [
          ...new Set(row.occurrences.map((o) => o.occurrence.due_date)),
        ].sort(),
        recurrence: template
          ? parseRule(JSON.parse(template.recurrence))
          : { version: 1 as const, kind: "once" as const },
        anchorDate: template?.anchor_date ?? meeting!.date,
        repeating:
          !!template &&
          !template.archived &&
          parseRule(JSON.parse(template.recurrence)).kind !== "once",
        canAddTasks:
          SUGGESTIONS.find(
            (suggestion) =>
              suggestion.key ===
              canonicalSuggestionKey(template?.suggestion_key ?? null),
          )?.supportsTasks !== false,
        tasks: row.tasks.map((t) => ({
          id: t.task.id,
          title: t.task.title ?? "Member task",
          completed: !!t.task.completed_at,
        })),
      };
    });
  const activeSuggestions = series
    ? await suggestionState(prisma, series.id, meeting?.id)
    : [];
  const tasks = await prisma.task.findMany({
    where: { ward_id: wardId, completed_at: null },
    select: {
      id: true,
      title: true,
      member: { select: { first_name: true, last_name: true } },
    },
    orderBy: { created_at: "desc" },
  });
  const users = await prisma.user.findMany({
    where: { ward_id: wardId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const schedule = series
    ? (JSON.parse(series.schedule) as { anchor: string; rule: unknown })
    : null;
  return {
    kind,
    today,
    title:
      kind === "bishopric"
        ? ward.type === "branch"
          ? "Branch presidency"
          : "Bishopric"
        : ward.type === "branch"
          ? "Branch council"
          : "Ward council",
    timeZone: ward.time_zone,
    series:
      series && schedule
        ? {
            id: series.id,
            anchor: schedule.anchor,
            schedule: parseRule(schedule.rule),
            startTime: series.start_time,
            targetMinutes: series.target_minutes,
          }
        : null,
    meetings,
    meeting,
    items,
    activeSuggestions,
    tasks: tasks.map((t) => ({
      id: t.id,
      title:
        t.title ??
        `${t.member?.first_name ?? ""} ${t.member?.last_name ?? ""}`.trim(),
    })),
    users,
  };
}
export type LeadershipData = Awaited<ReturnType<typeof loadLeadershipMeeting>>;
export type AgendaRow = LeadershipData["items"][number];
