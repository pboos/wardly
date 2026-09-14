"use client";

import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { speakersOfMeeting } from "@/lib/sunday-meetings/slots";
import { SundayInlinePeopleEditor } from "./sunday-inline-people-editor";
import { EmptyCell } from "./sunday-empty-cell";
import { updateSundayAgendaItem, addSundayAgendaItem } from "./actions";

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
  if (!local || meeting.type === "childrens_sacrament_presentation") {
    return <EmptyCell />;
  }
  const talk = speakersOfMeeting(meeting.items)[index] ?? null;

  return (
    <SundayInlinePeopleEditor
      items={talk?.personNameResolved ? [talk] : []}
      members={members}
      label={`Speaker ${index + 1}`}
      maxPeople={1}
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
