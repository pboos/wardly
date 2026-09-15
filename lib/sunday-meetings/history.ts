import type {
  AssignmentDate,
  SundayMeetingMemberHistory,
  SundayMeetingType,
} from "./types.ts";

type HistoryMember = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
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
    { past?: HistoryItem; future?: HistoryItem }
  >();
  for (const item of items) {
    if (item.type !== "talk" && item.type !== "prayer") {
      continue;
    }
    const key = `${item.memberId}:${item.type}`;
    const boundary = boundaries.get(key) ?? {};
    const date = item.sunday_meeting.date;
    if (date < today && (!boundary.past || date > boundary.past.sunday_meeting.date)) {
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
    direction: "past" | "future",
  ) {
    const boundary = boundaries.get(`${memberId}:${kind}`);
    const match = direction === "past" ? boundary?.past : boundary?.future;
    return selectedDate(match, isMeetingType);
  }

  return members
    .map((member) => ({
      id: member.id,
      name: `${member.first_name} ${member.last_name}`.trim(),
      status: member.status,
      lastTalk: dateFor(member.id, "talk", "past"),
      nextTalk: dateFor(member.id, "talk", "future"),
      lastPrayer: dateFor(member.id, "prayer", "past"),
      nextPrayer: dateFor(member.id, "prayer", "future"),
    }))
    .sort((left, right) =>
      (left.lastTalk?.date ?? left.lastPrayer?.date ?? "").localeCompare(
        right.lastTalk?.date ?? right.lastPrayer?.date ?? "",
      ),
    );
}
