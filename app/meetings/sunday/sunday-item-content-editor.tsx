"use client";
import type { SundayMeetingItem } from "@/lib/sunday-meetings/types";
import { updateSundayAgendaItem } from "./actions";
import { SundayHymnPicker } from "./sunday-hymn-picker";
import { ItemContentDialog } from "./sunday-item-content-dialog";
import { contentLabel } from "./sunday-item-editors";

export function SundayItemContentEditor({ item }: { item: SundayMeetingItem }) {
  if (item.type === "hymn" || item.type === "musical_number") {
    return (
      <>
        <SundayHymnPicker
          item={item}
          allowMusicalNumber={
            item.slot === "interlude" ||
            (!item.slot && item.section === "program")
          }
          onSave={(input) => updateSundayAgendaItem(item.id, input)}
        />
        {item.type === "musical_number" && (
          <ItemContentDialog
            label="Musical number and performers"
            triggerLabel="Edit details and performers"
            initialValue={[item.content, item.personNameResolved]
              .filter(Boolean)
              .join(" — ")}
            onSave={(content) =>
              updateSundayAgendaItem(item.id, {
                content: content || "Musical number",
                person: null,
              })
            }
          />
        )}
      </>
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
