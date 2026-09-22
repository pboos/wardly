"use client";
import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { participantsByType } from "@/lib/sunday-meetings/slots";
import { SundayPeoplePicker } from "./sunday-people-picker";
import { SundayParticipantRoles } from "./sunday-participant-roles";
import {
  addSundayAgendaItem as addSundayAgendaItemAction,
  deleteSundayAgendaItem as deleteSundayAgendaItemAction,
  updateSundayAgendaItem as updateSundayAgendaItemAction,
  upsertSundaySlotItem as upsertSundaySlotItemAction,
} from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";

type ParticipantType =
  "leader" | "presiding" | "organist" | "music_conductor" | "visitor";

export function SundayContextPeople({
  meeting,
  members,
  type,
  label,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  type: ParticipantType;
  label: string;
}) {
  const { execute: addSundayAgendaItem } = useAppMutation(
    addSundayAgendaItemAction,
  );
  const { execute: deleteSundayAgendaItem } = useAppMutation(
    deleteSundayAgendaItemAction,
  );
  const { execute: updateSundayAgendaItem } = useAppMutation(
    updateSundayAgendaItemAction,
  );
  const { execute: upsertSundaySlotItem } = useAppMutation(
    upsertSundaySlotItemAction,
  );

  const items = participantsByType(meeting.items, type);
  const unassigned = items.find((item) => !item.personNameResolved);
  const single = type === "leader" || type === "presiding";
  const hasRole = type === "visitor" || type === "presiding";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <span className="text-sm font-medium sm:w-36 sm:shrink-0">{label}</span>
      <div className="min-w-0 flex-1">
        <SundayPeoplePicker
          label={label}
          items={items}
          members={members}
          maxPeople={single ? 1 : undefined}
          layout="vertical"
          renderDetails={
            hasRole
              ? (item) => <SundayParticipantRoles item={item} />
              : undefined
          }
          onAdd={(person) =>
            unassigned
              ? updateSundayAgendaItem(unassigned.id, { person })
              : single
                ? upsertSundaySlotItem(meeting.id, {
                    type,
                    section: "participants",
                    person,
                  })
                : addSundayAgendaItem(meeting.id, {
                    type,
                    section: "participants",
                    person,
                  })
          }
          onRemove={(item) => deleteSundayAgendaItem(item.id)}
        />
        {hasRole &&
          items
            .filter((item) => !item.personNameResolved && item.content)
            .map((item) => (
              <SundayParticipantRoles key={item.id} item={item} />
            ))}
      </div>
    </div>
  );
}
