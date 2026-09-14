"use client";
import type { SundayMeetingItem } from "@/lib/sunday-meetings/types";
import { updateSundayAgendaItem } from "./actions";
import { SundayInlineHymnEditor } from "./sunday-inline-hymn-editor";
import { ItemContentDialog } from "./sunday-item-content-dialog";
import { contentLabel } from "./sunday-item-editors";

export function SundayItemContentEditor({ item }: { item: SundayMeetingItem }) {
  if (item.type === "hymn" || item.slot === "interlude") {
    return (
      <SundayInlineHymnEditor
        item={item}
        allowMusicalNumber={item.slot === "interlude"}
        onSave={(input) => updateSundayAgendaItem(item.id, input)}
      />
    );
  }
  const label = contentLabel(item.type);
  return label ? (
    <ItemContentDialog
      label={label}
      triggerLabel="Edit details"
      initialValue={item.content ?? ""}
      onSave={(content) => updateSundayAgendaItem(item.id, { content })}
    />
  ) : null;
}
