"use client";
import type { SundayMeetingItem } from "@/lib/sunday-meetings/types";
import { ItemContentDialog } from "./sunday-item-content-dialog";
import { updateSundayAgendaItem as updateSundayAgendaItemAction } from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";

export function SundayParticipantRoles({ item }: { item: SundayMeetingItem }) {
  const { execute: updateSundayAgendaItem } = useAppMutation(
    updateSundayAgendaItemAction,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.content && (
        <span className="text-sm text-muted-foreground">{item.content}</span>
      )}
      <ItemContentDialog
        label="Role (optional)"
        triggerLabel={item.content ? "Edit role" : "Add role"}
        initialValue={item.content ?? ""}
        onSave={(content) => updateSundayAgendaItem(item.id, { content })}
      />
    </div>
  );
}
