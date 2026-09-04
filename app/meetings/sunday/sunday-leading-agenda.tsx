"use client";

import type {
  SundayMeeting,
  SundayMeetingMemberHistory,
  SundayMeetingSupportText,
} from "@/lib/sunday-meetings/types";
import {
  agendaMoveTarget,
  agendaRowItem,
  buildAgendaRows,
} from "@/lib/sunday-meetings/agenda";
import { SundayLeadingItemRow } from "./sunday-leading-item-row";

/**
 * The agenda flow: virtual standard slots merged with the persisted
 * items (see lib/sunday-meetings/agenda), one row component per entry.
 */
export function SundayLeadingAgenda({
  meeting,
  members,
  showSupportText,
  supportText,
  run,
}: {
  meeting: SundayMeeting;
  members: SundayMeetingMemberHistory[];
  showSupportText: boolean;
  supportText: SundayMeetingSupportText[];
  run: (action: () => Promise<unknown>, fallback: string) => void;
}) {
  const rows = buildAgendaRows(meeting);

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => {
        const item = agendaRowItem(row);
        return (
          <SundayLeadingItemRow
            key={
              row.kind === "slot"
                ? `slot-${row.slot}`
                : row.kind === "item"
                  ? row.item.id
                  : `empty-${row.type}`
            }
            row={row}
            meeting={meeting}
            members={members}
            showSupportText={showSupportText}
            supportText={
              item
                ? supportText.filter((block) => block.itemId === item.id)
                : []
            }
            moveUp={item ? agendaMoveTarget(rows, item.id, "up") : null}
            moveDown={item ? agendaMoveTarget(rows, item.id, "down") : null}
            run={run}
          />
        );
      })}
    </ol>
  );
}
