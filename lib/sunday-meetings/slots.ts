import type {
  SundayMeetingItem,
  SundayMeetingItemType,
  SundayMeetingSection,
} from "./types.ts";
import { slotAllowsItemType, type SundayVirtualSlot } from "./templates.ts";
import { sortSundayItems } from "./order.ts";

/**
 * Slot identity for the (virtual) standard agenda slots: which persisted
 * item backs a slot is derived from the meeting's ordered items — first
 * match by type and section in final order.
 */

/** The section every virtual slot lives in. */
const SLOT_SECTION: Record<SundayVirtualSlot, SundayMeetingSection> = {
  opening_hymn: "opening",
  opening_prayer: "opening",
  sacrament_hymn: "sacrament",
  interlude: "program",
  primary_presentation: "program",
  closing_hymn: "closing",
  closing_prayer: "closing",
};

/** The persisted item backing a virtual slot, or undefined while the slot is still empty. */
export function findSlotItem(
  items: readonly SundayMeetingItem[],
  slot: SundayVirtualSlot,
): SundayMeetingItem | undefined {
  const section = SLOT_SECTION[slot];
  // Items arrive pre-sorted from the loaders; sort defensively anyway so a
  // "first" match is always the first item in final order.
  return sortSundayItems(items).find(
    (item) => item.section === section && slotAllowsItemType(slot, item.type),
  );
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
