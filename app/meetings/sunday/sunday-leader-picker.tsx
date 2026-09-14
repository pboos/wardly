"use client";

import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { leaderOfMeeting } from "@/lib/sunday-meetings/slots";
import { SundayInlinePeopleEditor } from "./sunday-inline-people-editor";
import { upsertSundaySlotItem, updateSundayAgendaItem } from "./actions";

export function LeaderPicker({
  meeting,
  members,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
}) {
  const leader = leaderOfMeeting(meeting.items);
  return (
    <SundayInlinePeopleEditor
      label="Meeting leader"
      items={leader ? [leader] : []}
      members={members}
      maxPeople={1}
      onAdd={(person) =>
        upsertSundaySlotItem(meeting.id, {
          type: "leader",
          section: "participants",
          person,
        })
      }
      onRemove={(item) => updateSundayAgendaItem(item.id, { person: null })}
    />
  );
}
