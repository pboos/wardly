"use client";
import type {
  SundayMeetingItem,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { SundayPeoplePicker } from "./sunday-people-picker";
import { updateSundayAgendaItem } from "./actions";
import { PERSON_EDITORS, personTitle } from "./sunday-item-editors";

export function SundayItemPersonEditor({
  item,
  members,
}: {
  item: SundayMeetingItem;
  members: SundayMeetingMemberHistory[];
}) {
  return (
    <SundayPeoplePicker
      items={[item]}
      layout="vertical"
      maxPeople={1}
      members={members}
      label={personTitle(item.type)}
      roleWithHistory={PERSON_EDITORS[item.type]?.history ?? null}
      onAdd={(person) => updateSundayAgendaItem(item.id, { person })}
      onRemove={() => updateSundayAgendaItem(item.id, { person: null })}
    />
  );
}
