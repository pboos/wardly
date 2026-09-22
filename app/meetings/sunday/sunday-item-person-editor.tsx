"use client";
import type {
  SundayMeetingItem,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { SundayPeoplePicker } from "./sunday-people-picker";
import { isSacramentRole } from "@/lib/sunday-meetings/sacrament";
import {
  addSundaySacramentPerson as addSundaySacramentPersonAction,
  updateSundayAgendaItem as updateSundayAgendaItemAction,
} from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";
import { PERSON_EDITORS, personTitle } from "./sunday-item-editors";

export function SundayItemPersonEditor({
  item,
  members,
  compact = false,
  people = [item],
}: {
  item: SundayMeetingItem;
  people?: SundayMeetingItem[];
  compact?: boolean;
  members: SundayMeetingMemberHistory[];
}) {
  const { execute: addSundaySacramentPerson } = useAppMutation(
    addSundaySacramentPersonAction,
  );
  const { execute: updateSundayAgendaItem } = useAppMutation(
    updateSundayAgendaItemAction,
  );

  return (
    <SundayPeoplePicker
      items={people}
      compact={compact}
      layout="vertical"
      maxPeople={
        item.type === "sacrament_blessing"
          ? 2
          : item.type === "sacrament_passing"
            ? undefined
            : 1
      }
      members={members}
      label={personTitle(item.type)}
      roleWithHistory={PERSON_EDITORS[item.type]?.history ?? null}
      onAdd={(person) =>
        isSacramentRole(item.type)
          ? addSundaySacramentPerson(item.id, person)
          : updateSundayAgendaItem(item.id, { person })
      }
      onRemove={(personItem) =>
        updateSundayAgendaItem(personItem.id, { person: null })
      }
    />
  );
}
