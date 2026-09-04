import type {
  SundayMeetingItemType,
  SundayMeetingSection,
  SundayMeetingType,
} from "./types.ts";

/**
 * The virtual (never persisted) standard slots the planner offers per
 * meeting type. Persisted items are created lazily once real data is entered.
 */
export type SundayVirtualSlot =
  | "opening_hymn"
  | "opening_prayer"
  | "sacrament_hymn"
  | "interlude"
  | "primary_presentation"
  | "closing_hymn"
  | "closing_prayer";

export type SundayVirtualAgendaEntry = {
  slot: SundayVirtualSlot;
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
};

export function virtualAgendaForMeeting(
  type: SundayMeetingType,
): SundayVirtualAgendaEntry[] {
  if (type === "stake_conference" || type === "general_conference") {
    return [];
  }

  const entries: SundayVirtualAgendaEntry[] = [
    { slot: "opening_hymn", type: "hymn", section: "opening" },
    { slot: "opening_prayer", type: "prayer", section: "opening" },
    { slot: "sacrament_hymn", type: "hymn", section: "sacrament" },
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

/** The default type rank per section (earlier = first). */
export const SECTION_TYPE_ORDER: Record<
  SundayMeetingSection,
  readonly SundayMeetingItemType[]
> = {
  participants: ["leader", "presiding", "visitor", "organist", "music_conductor"],
  opening: ["announcement", "hymn", "prayer"],
  business: [
    "calling_sustain",
    "calling_release",
    "priesthood_aaronic_inform",
    "member_welcome",
    "child_naming_blessing",
    "convert_confirmation",
    "ward_business",
  ],
  sacrament: ["hymn", "sacrament_blessing", "sacrament_passing"],
  program: ["hymn", "musical_number", "talk", "primary_presentation", "custom_program"],
  closing: ["hymn", "prayer"],
};

/** 0-based index in the section's rank list; absent types rank after all listed ones. */
export function defaultRank(
  section: SundayMeetingSection,
  type: SundayMeetingItemType,
): number {
  const order = SECTION_TYPE_ORDER[section];
  const index = order.indexOf(type);
  return index >= 0 ? index : order.length + 1;
}

/** The item type that backs a virtual slot when no persisted row exists. */
export function virtualSlotType(
  slot: SundayVirtualSlot,
): SundayMeetingItemType {
  switch (slot) {
    case "opening_prayer":
    case "closing_prayer":
      return "prayer";
    case "primary_presentation":
      return "primary_presentation";
    default:
      return "hymn";
  }
}

export function slotAllowsItemType(
  slot: SundayVirtualSlot,
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
