import type {
  AssignmentDate,
  SundayMeetingMemberHistory,
  SundayMeetingType,
} from "./types.ts";

type HistoryMember = {
  id: string;
  first_name: string;
  last_name: string;
  is_moved_out: boolean;
};

/** A persisted agenda item naming a member; `type` is "talk" | "prayer". */
type HistoryItem = {
  memberId: string;
  type: string;
  sunday_meeting: { date: string; type: string };
};

function selectedDate(
  item: HistoryItem | undefined,
  isMeetingType: (value: string) => value is SundayMeetingType,
): AssignmentDate | null {
  if (!item || !isMeetingType(item.sunday_meeting.type)) return null;
  return {
    date: item.sunday_meeting.date,
    meetingType: item.sunday_meeting.type,
  };
}

export function buildSundayMeetingMemberHistory(
  members: HistoryMember[],
  items: HistoryItem[],
  today: string,
  isMeetingType: (value: string) => value is SundayMeetingType,
): SundayMeetingMemberHistory[] {
  const boundaries = new Map<
    string,
    { past?: HistoryItem; future?: HistoryItem; latest?: HistoryItem }
  >();
  for (const item of items) {
    if (item.type !== "talk" && item.type !== "prayer") {
      continue;
    }
    const key = `${item.memberId}:${item.type}`;
    const boundary = boundaries.get(key) ?? {};
    const date = item.sunday_meeting.date;
    if (!boundary.latest || date > boundary.latest.sunday_meeting.date) {
      boundary.latest = item;
    }
    if (
      date < today &&
      (!boundary.past || date > boundary.past.sunday_meeting.date)
    ) {
      boundary.past = item;
    } else if (
      date >= today &&
      (!boundary.future || date < boundary.future.sunday_meeting.date)
    ) {
      boundary.future = item;
    }
    boundaries.set(key, boundary);
  }

  function dateFor(
    memberId: string,
    kind: "talk" | "prayer",
    direction: "past" | "future" | "latest",
  ) {
    const boundary = boundaries.get(`${memberId}:${kind}`);
    const match = boundary?.[direction];
    return selectedDate(match, isMeetingType);
  }

  return members
    .map((member) => ({
      id: member.id,
      name: `${member.first_name} ${member.last_name}`.trim(),
      is_moved_out: member.is_moved_out,
      lastTalk: dateFor(member.id, "talk", "past"),
      nextTalk: dateFor(member.id, "talk", "future"),
      lastPrayer: dateFor(member.id, "prayer", "past"),
      nextPrayer: dateFor(member.id, "prayer", "future"),
      latestTalk: dateFor(member.id, "talk", "latest"),
      latestPrayer: dateFor(member.id, "prayer", "latest"),
    }))
    .sort((left, right) =>
      (left.lastTalk?.date ?? left.lastPrayer?.date ?? "").localeCompare(
        right.lastTalk?.date ?? right.lastPrayer?.date ?? "",
      ),
    );
}

export type SundayAssignmentKind = "prayer" | "talk";

export function buildSundayAssignmentHistoryRows(
  members: SundayMeetingMemberHistory[],
  kind: SundayAssignmentKind,
  includeNeverAssigned: boolean,
) {
  return members
    .filter((member) => !member.is_moved_out && !member.exclusionTags?.length)
    .map((member) => ({
      id: member.id,
      name: member.name,
      latest: kind === "talk" ? member.latestTalk : member.latestPrayer,
    }))
    .filter((member) => includeNeverAssigned || member.latest !== null)
    .sort((left, right) =>
      (left.latest?.date ?? "").localeCompare(right.latest?.date ?? "") ||
      left.name.localeCompare(right.name, "en") ||
      left.id.localeCompare(right.id, "en"),
    );
}
