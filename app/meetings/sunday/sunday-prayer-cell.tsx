"use client";

import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
} from "@/lib/sunday-meetings/types";
import { standardAgendaForMeeting } from "@/lib/sunday-meetings/templates";
import { findSlotItem } from "@/lib/sunday-meetings/slots";
import { SundayInlinePeopleEditor } from "./sunday-inline-people-editor";
import { EmptyCell } from "./sunday-empty-cell";
import { updateSundayAgendaItem, upsertSundaySlotItem } from "./actions";
type PrayerSlot = "opening_prayer" | "closing_prayer";

export function PrayerCell({
  meeting,
  slot,
  members,
}: {
  meeting: SundayMeeting;
  slot: PrayerSlot;
  members: SundayMeetingMemberHistory[];
}) {
  const entry = standardAgendaForMeeting(meeting.type).find(
    (candidate) => candidate.slot === slot,
  );
  if (!entry) return <EmptyCell />;
  const item = findSlotItem(meeting.items, slot);
  const title = slot === "opening_prayer" ? "Opening prayer" : "Closing prayer";

  return (
    <SundayInlinePeopleEditor
      items={item ? [item] : []}
      members={members}
      label={title}
      maxPeople={1}
      onAdd={(person) =>
        item
          ? updateSundayAgendaItem(item.id, { person })
          : upsertSundaySlotItem(meeting.id, {
              type: "prayer",
              section: entry.section,
              person,
              slot,
            })
      }
      onRemove={(removed) =>
        updateSundayAgendaItem(removed.id, { person: null })
      }
    />
  );
}
