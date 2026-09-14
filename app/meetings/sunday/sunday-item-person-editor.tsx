"use client";
import type {
  SundayMeetingItem,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { SundayPersonDialog } from "./sunday-person-dialog";
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
    <SundayPersonDialog
      item={item}
      members={members}
      title={personTitle(item.type)}
      triggerLabel={`Assign ${personTitle(item.type).toLowerCase()}`}
      roleWithHistory={PERSON_EDITORS[item.type]?.history ?? null}
      onSave={(person) => updateSundayAgendaItem(item.id, { person })}
      onDelete={() => updateSundayAgendaItem(item.id, { person: null })}
    />
  );
}
