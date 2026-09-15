"use client";
import type { SundayMeetingItem } from "@/lib/sunday-meetings/types";
import { updateSundayAgendaItem } from "./actions";
import { SundayHymnPicker } from "./sunday-hymn-picker";
import { ItemContentDialog } from "./sunday-item-content-dialog";
import { contentLabel } from "./sunday-item-editors";

export function SundayItemContentEditor({
  item,
  inline = false,
}: {
  item: SundayMeetingItem;
  inline?: boolean;
}) {
  if (item.type === "hymn" || item.type === "musical_number") {
    return (
      <SundayHymnPicker
        item={item}
        inline={inline}
        allowMusicalNumber={
          item.type === "musical_number" ||
          item.slot === "interlude" ||
          (!item.slot && item.section === "program")
        }
        onSave={(input) => updateSundayAgendaItem(item.id, input)}
      />
    );
  }
  const label = contentLabel(item.type);
  return label ? (
    <ItemContentDialog
      label={label}
      inline={inline}
      triggerLabel={
        inline
          ? item.content || (item.type === "talk" ? "Add topic" : "Add details")
          : "Edit details"
      }
      initialValue={item.content ?? ""}
      onSave={(content) => updateSundayAgendaItem(item.id, { content })}
    />
  ) : null;
}
