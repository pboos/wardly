import type {
  AssignmentDate,
  SundayMeetingMemberHistory,
  SundayMeetingType,
} from "./types";

type HistoryMember = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
};

type HistoryAssignment = {
  member_id: string | null;
  role: string;
  sunday_meeting: { date: string; type: string };
};

function selectedDate(
  assignment: HistoryAssignment | undefined,
  isMeetingType: (value: string) => value is SundayMeetingType,
): AssignmentDate | null {
  if (!assignment || !isMeetingType(assignment.sunday_meeting.type)) return null;
  return {
    date: assignment.sunday_meeting.date,
    meetingType: assignment.sunday_meeting.type,
  };
}

export function buildSundayMeetingMemberHistory(
  members: HistoryMember[],
  assignments: HistoryAssignment[],
  today: string,
  isMeetingType: (value: string) => value is SundayMeetingType,
): SundayMeetingMemberHistory[] {
  const boundaries = new Map<string, { past?: HistoryAssignment; future?: HistoryAssignment }>();
  for (const assignment of assignments) {
    if (!assignment.member_id || (assignment.role !== "speaker" && assignment.role !== "prayer")) {
      continue;
    }
    const key = `${assignment.member_id}:${assignment.role}`;
    const boundary = boundaries.get(key) ?? {};
    const date = assignment.sunday_meeting.date;
    if (date < today && (!boundary.past || date > boundary.past.sunday_meeting.date)) {
      boundary.past = assignment;
    } else if (date >= today && (!boundary.future || date < boundary.future.sunday_meeting.date)) {
      boundary.future = assignment;
    }
    boundaries.set(key, boundary);
  }

  function dateFor(memberId: string, role: "speaker" | "prayer", direction: "past" | "future") {
    const boundary = boundaries.get(`${memberId}:${role}`);
    const match = direction === "past" ? boundary?.past : boundary?.future;
    return selectedDate(match, isMeetingType);
  }

  return members
    .map((member) => ({
      id: member.id,
      name: `${member.first_name} ${member.last_name}`.trim(),
      status: member.status,
      lastTalk: dateFor(member.id, "speaker", "past"),
      nextTalk: dateFor(member.id, "speaker", "future"),
      lastPrayer: dateFor(member.id, "prayer", "past"),
      nextPrayer: dateFor(member.id, "prayer", "future"),
    }))
    .sort((left, right) =>
      (left.lastTalk?.date ?? left.lastPrayer?.date ?? "").localeCompare(
        right.lastTalk?.date ?? right.lastPrayer?.date ?? "",
      ),
    );
}
