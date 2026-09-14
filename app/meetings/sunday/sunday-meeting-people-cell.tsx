"use client";

import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { participantsByType } from "@/lib/sunday-meetings/slots";
import { SundayInlinePeopleEditor } from "./sunday-inline-people-editor";
import { addSundayAgendaItem, deleteSundayAgendaItem } from "./actions";
type ParticipantType = "organist" | "music_conductor";

export function MeetingPeopleCell({
  meeting,
  role,
  members,
}: {
  meeting: SundayMeeting;
  role: ParticipantType;
  members: SundayMeetingMemberHistory[];
}) {
  const label = role === "organist" ? "Organist" : "Music conductor";

  return (
    <SundayInlinePeopleEditor
      label={label}
      items={participantsByType(meeting.items, role)}
      members={members}
      onAdd={(person) =>
        addSundayAgendaItem(meeting.id, {
          type: role,
          section: "participants",
          person,
        })
      }
      // Delete the row directly: participant items are one-person-per-row, and
      // the auto-delete-on-null-person path could leave a role-text-only row behind.
      onRemove={(item) => deleteSundayAgendaItem(item.id)}
    />
  );
}
