"use client";

import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { leaderOfMeeting } from "@/lib/sunday-meetings/slots";
import { SundayPeoplePicker } from "./sunday-people-picker";
import {
  upsertSundaySlotItem as upsertSundaySlotItemAction,
  updateSundayAgendaItem as updateSundayAgendaItemAction,
} from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";

export function LeaderPicker({
  meeting,
  members,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
}) {
  const { execute: upsertSundaySlotItem } = useAppMutation(
    upsertSundaySlotItemAction,
  );
  const { execute: updateSundayAgendaItem } = useAppMutation(
    updateSundayAgendaItemAction,
  );

  const leader = leaderOfMeeting(meeting.items);
  return (
    <SundayPeoplePicker
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
