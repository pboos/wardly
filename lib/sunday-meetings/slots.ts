import type { SundayMeetingItem, SundayMeetingItemType } from "./types.ts";
import { type SundayStandardSlot } from "./templates.ts";
import { sortSundayItems } from "./order.ts";

/** Standard slot identity is stored, never inferred from item position. */
export function findSlotItem(
  items: readonly SundayMeetingItem[],
  slot: SundayStandardSlot,
): SundayMeetingItem | undefined {
  return items.find((item) => item.slot === slot);
}

/** All talk items in the program section, in final order. */
export function speakersOfMeeting(
  items: readonly SundayMeetingItem[],
): SundayMeetingItem[] {
  return sortSundayItems(items).filter(
    (item) => item.section === "program" && item.type === "talk",
  );
}

/** All items of one type (typically participants rows), in final order. */
export function participantsByType(
  items: readonly SundayMeetingItem[],
  type: SundayMeetingItemType,
): SundayMeetingItem[] {
  return sortSundayItems(items).filter((item) => item.type === type);
}

/** The meeting's single conducting-leader row, if one exists. */
export function leaderOfMeeting(
  items: readonly SundayMeetingItem[],
): SundayMeetingItem | undefined {
  return participantsByType(items, "leader")[0];
}

/** The meeting's single presiding row, if one exists. */
export function presiderOfMeeting(
  items: readonly SundayMeetingItem[],
): SundayMeetingItem | undefined {
  return participantsByType(items, "presiding")[0];
}
