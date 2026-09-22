"use client";

import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { speakersOfMeeting } from "@/lib/sunday-meetings/slots";
import { SundayPeoplePicker } from "./sunday-people-picker";
import { EmptyCell } from "./sunday-empty-cell";
import {
  updateSundayAgendaItem as updateSundayAgendaItemAction,
  addSundayAgendaItem as addSundayAgendaItemAction,
} from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";

export function SpeakerCell({
  meeting,
  index,
  local,
  members,
}: {
  meeting: SundayMeeting;
  index: number;
  local: boolean;
  members: SundayMeetingMemberHistory[];
}) {
  const { execute: updateSundayAgendaItem } = useAppMutation(
    updateSundayAgendaItemAction,
  );
  const { execute: addSundayAgendaItem } = useAppMutation(
    addSundayAgendaItemAction,
  );

  if (!local || meeting.type === "childrens_sacrament_presentation") {
    return <EmptyCell />;
  }
  const talk = speakersOfMeeting(meeting.items)[index] ?? null;

  return (
    <SundayPeoplePicker
      items={talk?.personNameResolved ? [talk] : []}
      members={members}
      label={`Speaker ${index + 1}`}
      maxPeople={1}
      roleWithHistory="speaker"
      onAdd={(person) =>
        talk
          ? updateSundayAgendaItem(talk.id, { person })
          : addSundayAgendaItem(meeting.id, {
              type: "talk",
              section: "program",
              person,
            })
      }
      onRemove={(removed) =>
        updateSundayAgendaItem(removed.id, { person: null })
      }
    />
  );
}
