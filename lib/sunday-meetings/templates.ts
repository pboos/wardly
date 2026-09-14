import type {
  SundayMeetingItemType,
  SundayMeetingSection,
  SundayMeetingType,
} from "./types.ts";

/**
 * Standard slots created with each local meeting, including empty entries.
 */
export type SundayStandardSlot =
  | "opening_hymn"
  | "opening_prayer"
  | "sacrament_hymn"
  | "sacrament_blessing"
  | "sacrament_passing"
  | "interlude"
  | "primary_presentation"
  | "closing_hymn"
  | "closing_prayer";

export type SundayStandardAgendaEntry = {
  slot: SundayStandardSlot;
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
};

export function standardAgendaForMeeting(
  type: SundayMeetingType,
): SundayStandardAgendaEntry[] {
  if (type === "stake_conference" || type === "general_conference") {
    return [];
  }

  const entries: SundayStandardAgendaEntry[] = [
    { slot: "opening_hymn", type: "hymn", section: "opening" },
    { slot: "opening_prayer", type: "prayer", section: "opening" },
    { slot: "sacrament_hymn", type: "hymn", section: "sacrament" },
    {
      slot: "sacrament_blessing",
      type: "sacrament_blessing",
      section: "sacrament",
    },
    {
      slot: "sacrament_passing",
      type: "sacrament_passing",
      section: "sacrament",
    },
  ];

  if (type === "childrens_sacrament_presentation") {
    entries.push({
      slot: "primary_presentation",
      type: "primary_presentation",
      section: "program",
    });
  } else if (type !== "fast_testimony") {
    entries.push({ slot: "interlude", type: "hymn", section: "program" });
  }

  entries.push(
    { slot: "closing_hymn", type: "hymn", section: "closing" },
    { slot: "closing_prayer", type: "prayer", section: "closing" },
  );

  return entries;
}

export const SECTION_ORDER: Record<SundayMeetingSection, number> = {
  participants: 0,
  opening: 1,
  business: 2,
  sacrament: 3,
  program: 4,
  closing: 5,
};

export function slotAllowsItemType(
  slot: SundayStandardSlot,
  itemType: SundayMeetingItemType,
): boolean {
  if (slot === "sacrament_blessing" || slot === "sacrament_passing") {
    return itemType === slot;
  }
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

export function isStandardSlot(value: unknown): value is SundayStandardSlot {
  return (
    typeof value === "string" &&
    [
      ...standardAgendaForMeeting("sacrament"),
      ...standardAgendaForMeeting("childrens_sacrament_presentation"),
    ].some((entry) => entry.slot === value)
  );
}
