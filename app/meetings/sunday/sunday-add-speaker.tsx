"use client";
import type { SundayMeetingMemberHistory } from "@/lib/sunday-meetings/types";
import { SundayPersonDialog } from "./sunday-person-dialog";
import { addSundayAgendaItem } from "./actions";
import { hasSundayPerson } from "./sunday-leading-labels";

export function SundayAddSpeaker({
  meetingId,
  members,
}: {
  meetingId: string;
  members: SundayMeetingMemberHistory[];
}) {
  return (
    <SundayPersonDialog
      item={null}
      members={members}
      title="Speaker"
      triggerLabel="Add speaker"
      detailLabel="Talk topic"
      roleWithHistory="speaker"
      onSave={(person, topic) =>
        hasSundayPerson(person) || topic
          ? addSundayAgendaItem(meetingId, {
              type: "talk",
              section: "program",
              person,
              content: topic,
            }).then(() => undefined)
          : Promise.resolve()
      }
    />
  );
}
