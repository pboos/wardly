"use client";
import type { SundayMeetingMemberHistory } from "@/lib/sunday-meetings/types";
import { SundayPeoplePicker } from "./sunday-people-picker";
import { addSundayAgendaItem as addSundayAgendaItemAction } from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";

export function SundayAddSpeaker({
  meetingId,
  members,
}: {
  meetingId: string;
  members: SundayMeetingMemberHistory[];
}) {
  const { execute: addSundayAgendaItem } = useAppMutation(
    addSundayAgendaItemAction,
  );

  return (
    <SundayPeoplePicker
      label="Speaker"
      items={[]}
      members={members}
      layout="vertical"
      roleWithHistory="speaker"
      onAdd={(person) =>
        addSundayAgendaItem(meetingId, {
          type: "talk",
          section: "program",
          person,
        })
      }
      onRemove={async () => {}}
    />
  );
}
