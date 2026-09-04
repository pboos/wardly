import {
  SUNDAY_MEETING_ITEM_TYPES,
  SUNDAY_MEETING_TASK_ITEM_TYPES,
  type SundayMeetingItemType,
  type SundayMeetingSection,
  type SundayPersonInput,
} from "@/lib/sunday-meetings/types";
import type { SundayVirtualSlot } from "@/lib/sunday-meetings/templates";

/** Shared display labels of the leading view. */

export const ITEM_LABELS: Record<SundayMeetingItemType, string> = {
  hymn: "Hymn",
  prayer: "Prayer",
  talk: "Talk",
  sacrament_blessing: "Blessing the sacrament",
  sacrament_passing: "Passing the sacrament",
  musical_number: "Musical number",
  primary_presentation: "Primary presentation",
  calling_sustain: "Calling sustain",
  calling_release: "Calling release",
  priesthood_aaronic_inform: "Aaronic Priesthood information",
  child_naming_blessing: "Naming and blessing a child",
  member_welcome: "Member welcome",
  convert_confirmation: "Convert confirmation",
  announcement: "Announcement",
  ward_business: "Ward business",
  custom_program: "Custom program item",
  transition: "Transition",
  conductor_text: "Conductor text",
  leader: "Leader",
  organist: "Organist",
  music_conductor: "Music conductor",
  visitor: "Visitor",
  presiding: "Presiding",
};

/** Display names of the agenda sections (badges, select options). */
export const SECTION_LABELS: Record<SundayMeetingSection, string> = {
  participants: "Participants",
  opening: "Opening",
  business: "Ward business",
  sacrament: "Sacrament",
  program: "Program",
  closing: "Closing",
};

/** Titles of the virtual standard slots, matching the old slot labels. */
export const SLOT_LABELS: Record<SundayVirtualSlot, string> = {
  opening_hymn: "Opening Hymn",
  opening_prayer: "Opening Prayer",
  sacrament_hymn: "Sacrament Hymn",
  interlude: "Interlude",
  primary_presentation: "Primary Presentation",
  closing_hymn: "Closing Hymn",
  closing_prayer: "Closing Prayer",
};

/** Participant item types are meeting context, never agenda rows. */
const PARTICIPANT_ITEM_TYPES = [
  "leader",
  "organist",
  "music_conductor",
  "visitor",
  "presiding",
] as const satisfies readonly SundayMeetingItemType[];

/** Item types the add-item dialog offers (no task or participant rows). */
export const ADDABLE_ITEM_TYPES: readonly SundayMeetingItemType[] =
  SUNDAY_MEETING_ITEM_TYPES.filter(
    (type) =>
      !SUNDAY_MEETING_TASK_ITEM_TYPES.includes(type as never) &&
      !PARTICIPANT_ITEM_TYPES.includes(type as never),
  );

/** True when the person input carries an actual member or free-text name. */
export function hasSundayPerson(person: SundayPersonInput): boolean {
  return Boolean(person.memberId || person.personName?.trim());
}
