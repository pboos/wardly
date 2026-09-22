import type { SundayStandardSlot } from "./templates.ts";

export const SUNDAY_MEETING_TYPES = [
  "sacrament",
  "fast_testimony",
  "ward_conference",
  "childrens_sacrament_presentation",
  "stake_conference",
  "general_conference",
] as const;

export type SundayMeetingType = (typeof SUNDAY_MEETING_TYPES)[number];

export const SUNDAY_MEETING_TYPE_LABELS: Record<SundayMeetingType, string> = {
  sacrament: "Sacrament",
  fast_testimony: "Fast and Testimony",
  ward_conference: "Ward Conference",
  childrens_sacrament_presentation: "Children's Sacrament Meeting Presentation",
  stake_conference: "Stake Conference",
  general_conference: "General Conference",
};

export const LOCAL_SUNDAY_MEETING_TYPES = [
  "sacrament",
  "fast_testimony",
  "ward_conference",
  "childrens_sacrament_presentation",
] as const satisfies readonly SundayMeetingType[];

export const SUNDAY_MEETING_ITEM_TYPES = [
  "hymn",
  "prayer",
  "talk",
  "sacrament_blessing",
  "sacrament_passing",
  "musical_number",
  "primary_presentation",
  "calling_sustain",
  "calling_release",
  "priesthood_aaronic_inform",
  "child_naming_blessing",
  "member_welcome",
  "convert_confirmation",
  "announcement",
  "ward_business",
  "custom_program",
  "transition",
  "conductor_text",
  "leader",
  "organist",
  "music_conductor",
  "visitor",
  "presiding",
] as const;

export type SundayMeetingItemType = (typeof SUNDAY_MEETING_ITEM_TYPES)[number];

export type SundayMeetingTaskItemType = Extract<
  SundayMeetingItemType,
  | "calling_sustain"
  | "calling_release"
  | "priesthood_aaronic_inform"
  | "child_naming_blessing"
  | "member_welcome"
>;

export const SUNDAY_MEETING_TASK_ITEM_TYPES = [
  "calling_sustain",
  "calling_release",
  "priesthood_aaronic_inform",
  "child_naming_blessing",
  "member_welcome",
] as const satisfies readonly SundayMeetingTaskItemType[];

const TASK_EXCLUSIVE_SUNDAY_MEETING_ITEM_TYPES = [
  "calling_sustain",
  "calling_release",
  "priesthood_aaronic_inform",
] as const satisfies readonly SundayMeetingTaskItemType[];

export const SUNDAY_MEETING_SECTIONS = [
  "participants",
  "opening",
  "business",
  "sacrament",
  "program",
  "closing",
] as const;

export type SundayMeetingSection = (typeof SUNDAY_MEETING_SECTIONS)[number];

/** Structured extras on an item row, stored as JSON in `metadata`. */
export type SundayItemMetadata = { hymnNumber?: number };

/** One person on an item row: either a ward member or free text, or neither. */
export type SundayPersonInput = {
  memberId: string | null;
  personName: string | null;
};

export type SundayMeetingTaskSummary = {
  id: string;
  title: string | null;
  description: string | null;
  memberName: string | null;
};

export type SundayMeetingItem = {
  id: string;
  sundayMeetingId: string;
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  /** Explicit position within the section. */
  orderIndex: number;
  slot: SundayStandardSlot | null;
  content: string | null;
  metadata: SundayItemMetadata | null;
  personMemberId: string | null;
  personName: string | null;
  /** Member display name or free-text person; null when the row has no person. */
  personNameResolved: string | null;
  taskId: string | null;
  task: SundayMeetingTaskSummary | null;
  createdAt: string;
};

export type SundayMeeting = {
  id: string;
  wardId: string;
  date: string;
  type: SundayMeetingType;
  information: string | null;
  /** All persisted items in final order (section, explicit position). */
  items: SundayMeetingItem[];
  /** The `presiding` item, if the meeting has one. */
  presider: SundayMeetingItem | null;
};

export type SundayMeetingTaskCandidate = {
  scheduledMeeting: { id: string; date: string } | null;
  id: string;
  itemType: SundayMeetingTaskItemType;
  title: string | null;
  description: string | null;
  memberName: string | null;
};

export type SundayMeetingTaskCandidateGroup = {
  itemType: SundayMeetingTaskItemType;
  items: SundayMeetingTaskCandidate[];
};

export type AssignmentDate = {
  date: string;
  meetingType: SundayMeetingType;
};

export type SundayMeetingMemberHistory = {
  exclusionTags?: import("@/lib/members/choices").ExclusionTag[];
  id: string;
  name: string;
  is_moved_out: boolean;
  lastTalk: AssignmentDate | null;
  nextTalk: AssignmentDate | null;
  lastPrayer: AssignmentDate | null;
  nextPrayer: AssignmentDate | null;
};

export type SundayMeetingSupportText = {
  id: string;
  position: "meeting" | "before_item";
  itemId: string | null;
  text: string;
};

export function isSundayMeetingType(
  value: unknown,
): value is SundayMeetingType {
  return (
    typeof value === "string" &&
    (SUNDAY_MEETING_TYPES as readonly string[]).includes(value)
  );
}

export function isSundayMeetingItemType(
  value: unknown,
): value is SundayMeetingItemType {
  return (
    typeof value === "string" &&
    (SUNDAY_MEETING_ITEM_TYPES as readonly string[]).includes(value)
  );
}

export function isSundayMeetingTaskItemType(
  value: unknown,
): value is SundayMeetingTaskItemType {
  return (
    typeof value === "string" &&
    (SUNDAY_MEETING_TASK_ITEM_TYPES as readonly string[]).includes(value)
  );
}

/** Presentation types that cannot also be created as ordinary agenda items. */
export function isTaskExclusiveSundayMeetingItemType(
  value: unknown,
): value is (typeof TASK_EXCLUSIVE_SUNDAY_MEETING_ITEM_TYPES)[number] {
  return (
    typeof value === "string" &&
    (TASK_EXCLUSIVE_SUNDAY_MEETING_ITEM_TYPES as readonly string[]).includes(
      value,
    )
  );
}

export function isSundayMeetingSection(
  value: unknown,
): value is SundayMeetingSection {
  return (
    typeof value === "string" &&
    (SUNDAY_MEETING_SECTIONS as readonly string[]).includes(value)
  );
}

export function isLocalMeetingType(
  type: SundayMeetingType,
): type is (typeof LOCAL_SUNDAY_MEETING_TYPES)[number] {
  return (LOCAL_SUNDAY_MEETING_TYPES as readonly string[]).includes(type);
}

export function isCarryForwardEligible(type: SundayMeetingItemType): boolean {
  return [
    "calling_sustain",
    "calling_release",
    "priesthood_aaronic_inform",
    "child_naming_blessing",
    "member_welcome",
    "convert_confirmation",
    "announcement",
    "ward_business",
    "custom_program",
    "conductor_text",
  ].includes(type);
}

/**
 * Safely parse an item's JSON metadata. Invalid JSON and non-objects yield
 * null, and only known keys with valid value types are kept.
 */
export function parseItemMetadata(
  raw: string | null,
): SundayItemMetadata | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const hymnNumber = (parsed as Record<string, unknown>).hymnNumber;
    return typeof hymnNumber === "number" ? { hymnNumber } : null;
  } catch {
    return null;
  }
}
