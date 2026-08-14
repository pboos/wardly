import type {
  SundayMeetingItemType,
  SundayMeetingSection,
  SundayMeetingStandardSlot,
  SundayMeetingType,
} from "./types";
import { isLocalMeetingType } from "./types";

export type SundayMeetingTemplateItem = {
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  standardSlot: SundayMeetingStandardSlot;
};

export function templateForMeeting(
  type: SundayMeetingType,
): SundayMeetingTemplateItem[] {
  if (!isLocalMeetingType(type)) {
    return [];
  }

  const items: SundayMeetingTemplateItem[] = [
    { type: "hymn", section: "opening", standardSlot: "opening_hymn" },
    { type: "prayer", section: "opening", standardSlot: "opening_prayer" },
    {
      type: "hymn",
      section: "sacrament",
      standardSlot: "sacrament_hymn",
    },
  ];

  if (type === "childrens_sacrament_presentation") {
    items.push({
      type: "primary_presentation",
      section: "program",
      standardSlot: "primary_presentation",
    });
  } else if (type !== "fast_testimony") {
    items.push({ type: "hymn", section: "program", standardSlot: "interlude" });
  }

  items.push(
    { type: "hymn", section: "closing", standardSlot: "closing_hymn" },
    { type: "prayer", section: "closing", standardSlot: "closing_prayer" },
  );

  return items;
}

export function templateItemForSlot(
  type: SundayMeetingType,
  slot: SundayMeetingStandardSlot,
): SundayMeetingTemplateItem | undefined {
  return templateForMeeting(type).find((item) => item.standardSlot === slot);
}

export function slotAllowsItemType(
  slot: SundayMeetingStandardSlot,
  itemType: SundayMeetingItemType,
): boolean {
  if (slot === "interlude") {
    return itemType === "hymn" || itemType === "musical_number";
  }
  if (slot === "primary_presentation") {
    return itemType === "primary_presentation";
  }
  if (slot === "opening_prayer" || slot === "closing_prayer") {
    return itemType === "prayer";
  }
  return itemType === "hymn";
}

export const SECTION_ORDER: Record<SundayMeetingSection, number> = {
  opening: 0,
  business: 1,
  sacrament: 2,
  program: 3,
  closing: 4,
};
