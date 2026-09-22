"use client";

import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { participantsByType } from "@/lib/sunday-meetings/slots";
import { SundayPeoplePicker } from "./sunday-people-picker";
import {
  addSundayAgendaItem as addSundayAgendaItemAction,
  deleteSundayAgendaItem as deleteSundayAgendaItemAction,
} from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";
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
  const { execute: addSundayAgendaItem } = useAppMutation(
    addSundayAgendaItemAction,
  );
  const { execute: deleteSundayAgendaItem } = useAppMutation(
    deleteSundayAgendaItemAction,
  );

  const label = role === "organist" ? "Organist" : "Music conductor";

  return (
    <SundayPeoplePicker
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
