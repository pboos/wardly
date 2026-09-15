import {
  SUNDAY_MEETING_ITEM_TYPES,
  type SundayMeetingItemType,
  type SundayMeetingSection,
} from "./types.ts";

/** Placement rules for new extra agenda items only; moves remain unrestricted. */
const ADD_ITEM_SECTIONS: Partial<
  Record<SundayMeetingItemType, readonly SundayMeetingSection[]>
> = {
  hymn: ["opening", "closing", "sacrament", "program"],
  prayer: ["opening", "closing"],
  musical_number: ["opening", "program", "closing"],
  sacrament_blessing: ["sacrament"],
  sacrament_passing: ["sacrament"],
  talk: ["program"],
  primary_presentation: ["program"],
  child_naming_blessing: ["business"],
  member_welcome: ["business"],
  convert_confirmation: ["business"],
  announcement: ["opening"],
  ward_business: ["business"],
  custom_program: ["program"],
  transition: ["program"],
  conductor_text: ["opening", "business", "sacrament", "program", "closing"],
};

export function canAddAgendaItem(
  type: SundayMeetingItemType,
  section: SundayMeetingSection,
): boolean {
  return ADD_ITEM_SECTIONS[type]?.includes(section) ?? false;
}

export function addableAgendaItemTypes(section: SundayMeetingSection) {
  return SUNDAY_MEETING_ITEM_TYPES.filter((type) =>
    canAddAgendaItem(type, section),
  );
}
