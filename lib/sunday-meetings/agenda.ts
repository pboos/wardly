import { groupSacramentItems } from "./sacrament.ts";
import {
  isLocalMeetingType,
  type SundayMeeting,
  type SundayMeetingItem,
} from "./types.ts";
import {
  sortSundayItems,
  moveAgendaItems,
  type SundayAgendaMove,
} from "./order.ts";
import type { SundayStandardSlot } from "./templates.ts";

export const AGENDA_SECTIONS = [
  "opening",
  "business",
  "sacrament",
  "program",
  "closing",
] as const;
export type { SundayAgendaMove } from "./order.ts";
export type SundayAgendaRow = { people: SundayMeetingItem[] } & (
  | {
      kind: "slot";
      slot: SundayStandardSlot;
      section: SundayMeetingItem["section"];
      item: SundayMeetingItem;
    }
  | { kind: "item"; item: SundayMeetingItem }
);

export function agendaRowItem(row: SundayAgendaRow): SundayMeetingItem {
  return row.item;
}
export function agendaRowSection(row: SundayAgendaRow) {
  return row.item.section;
}

/** Every agenda row is persisted. Add-person controls live outside the list. */
export function buildAgendaRows(
  meeting: SundayMeeting,
  showSupportText = true,
): SundayAgendaRow[] {
  if (!isLocalMeetingType(meeting.type)) return [];
  return groupSacramentItems(
    sortSundayItems(meeting.items).filter(
      (item) =>
        item.section !== "participants" &&
        (showSupportText || item.type !== "conductor_text"),
    ),
  ).map(([item, ...others]) =>
    item.slot
      ? {
          kind: "slot",
          slot: item.slot,
          section: item.section,
          item,
          people: [item, ...others],
        }
      : { kind: "item", item, people: [item, ...others] },
  );
}

export function agendaMoveTarget(
  items: readonly SundayMeetingItem[],
  itemId: string,
  direction: "up" | "down",
  showSupportText: boolean,
): SundayAgendaMove | null {
  const move = { direction, showSupportText };
  return moveAgendaItems(items, itemId, move) ? move : null;
}
