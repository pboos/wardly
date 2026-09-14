"use client";

import type { SundayMeeting } from "@/lib/sunday-meetings/types";
import { standardAgendaForMeeting } from "@/lib/sunday-meetings/templates";
import { findSlotItem } from "@/lib/sunday-meetings/slots";
import { SundayInlineHymnEditor } from "./sunday-inline-hymn-editor";
import { EmptyCell } from "./sunday-empty-cell";
import { updateSundayAgendaItem, upsertSundaySlotItem } from "./actions";
type HymnSlot =
  "opening_hymn" | "sacrament_hymn" | "interlude" | "closing_hymn";

export function HymnCell({
  meeting,
  slot,
}: {
  meeting: SundayMeeting;
  slot: HymnSlot;
}) {
  const entry = standardAgendaForMeeting(meeting.type).find(
    (candidate) => candidate.slot === slot,
  );
  if (!entry) return <EmptyCell />;
  const item = findSlotItem(meeting.items, slot);

  return (
    <SundayInlineHymnEditor
      item={item ?? null}
      allowMusicalNumber={slot === "interlude"}
      onSave={(input) =>
        item
          ? updateSundayAgendaItem(item.id, input)
          : upsertSundaySlotItem(meeting.id, {
              ...input,
              section: entry.section,
              slot,
            })
      }
    />
  );
}
