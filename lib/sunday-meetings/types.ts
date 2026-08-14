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
] as const;

export type SundayMeetingItemType = (typeof SUNDAY_MEETING_ITEM_TYPES)[number];

export type SundayMeetingTaskItemType = Extract<
  SundayMeetingItemType,
  "calling_sustain" | "calling_release" | "priesthood_aaronic_inform"
>;

export const SUNDAY_MEETING_TASK_ITEM_TYPES = [
  "calling_sustain",
  "calling_release",
  "priesthood_aaronic_inform",
] as const satisfies readonly SundayMeetingTaskItemType[];

export const SUNDAY_MEETING_SECTIONS = [
  "opening",
  "business",
  "sacrament",
  "program",
  "closing",
] as const;

export type SundayMeetingSection = (typeof SUNDAY_MEETING_SECTIONS)[number];

export const SUNDAY_MEETING_STANDARD_SLOTS = [
  "opening_hymn",
  "opening_prayer",
  "sacrament_hymn",
  "interlude",
  "primary_presentation",
  "closing_hymn",
  "closing_prayer",
] as const;

export type SundayMeetingStandardSlot =
  (typeof SUNDAY_MEETING_STANDARD_SLOTS)[number];

export const MEETING_ASSIGNMENT_ROLES = [
  "leader",
  "organist",
  "music_conductor",
  "visitor",
] as const;

export type SundayMeetingAssignmentRole =
  (typeof MEETING_ASSIGNMENT_ROLES)[number];

export const ITEM_ASSIGNMENT_ROLES = [
  "prayer",
  "speaker",
  "sacrament_blesser",
  "sacrament_passer",
  "performer",
  "subject",
  "officiant",
] as const;

export type SundayMeetingItemAssignmentRole =
  (typeof ITEM_ASSIGNMENT_ROLES)[number];

export const VISITOR_ROLES = [
  "stake_president",
  "high_council",
  "general_authority",
  "other_authority",
  "custom",
] as const;

export type SundayMeetingVisitorRole = (typeof VISITOR_ROLES)[number];

export const VISITOR_ROLE_LABELS: Record<SundayMeetingVisitorRole, string> = {
  stake_president: "Stake President",
  high_council: "High Council",
  general_authority: "General Authority",
  other_authority: "Other visiting authority",
  custom: "Custom role",
};

export const ITEM_ROLE_BY_TYPE: Record<
  SundayMeetingItemType,
  readonly SundayMeetingItemAssignmentRole[]
> = {
  hymn: [],
  prayer: ["prayer"],
  talk: ["speaker"],
  sacrament_blessing: ["sacrament_blesser"],
  sacrament_passing: ["sacrament_passer"],
  musical_number: ["performer"],
  primary_presentation: ["performer"],
  calling_sustain: ["subject", "officiant"],
  calling_release: ["subject", "officiant"],
  priesthood_aaronic_inform: ["subject", "officiant"],
  child_naming_blessing: ["subject", "officiant"],
  member_welcome: ["subject"],
  convert_confirmation: ["subject", "officiant"],
  announcement: [],
  ward_business: [],
  custom_program: ["performer", "subject", "officiant"],
  transition: [],
  conductor_text: [],
};

export const SINGLE_ITEM_ASSIGNMENT_ROLES = ["prayer", "speaker"] as const;

export type SundayMeetingPersonInput = {
  memberId: string | null;
  freeTextName: string | null;
};

export type SundayMeetingAssignmentInput = SundayMeetingPersonInput & {
  visitorRole?: SundayMeetingVisitorRole | null;
  visitorRoleCustom?: string | null;
  isPresidingOverride?: boolean;
};

export type SundayMeetingTaskSummary = {
  id: string;
  title: string | null;
  description: string | null;
  memberName: string | null;
};

export type SundayMeetingAssignment = {
  id: string;
  sundayMeetingId: string;
  sundayMeetingItemId: string | null;
  role: SundayMeetingAssignmentRole | SundayMeetingItemAssignmentRole;
  memberId: string | null;
  freeTextName: string | null;
  name: string;
  orderIndex: number;
  visitorRole: SundayMeetingVisitorRole | null;
  visitorRoleCustom: string | null;
  isPresidingOverride: boolean;
};

export type SundayMeetingItem = {
  id: string;
  sundayMeetingId: string;
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  standardSlot: SundayMeetingStandardSlot | null;
  orderIndex: number;
  content: string | null;
  hymnNumber: number | null;
  taskId: string | null;
  task: SundayMeetingTaskSummary | null;
  assignments: SundayMeetingAssignment[];
};

export type SundayMeeting = {
  id: string;
  wardId: string;
  date: string;
  type: SundayMeetingType;
  information: string | null;
  items: SundayMeetingItem[];
  assignments: SundayMeetingAssignment[];
  presider: SundayMeetingAssignment | null;
};

export type HymnReference = {
  number: number | null;
  title: string | null;
  text: string | null;
};

export type SundayMeetingScheduleRow = {
  meeting: SundayMeeting;
  leader: string | null;
  organists: string[];
  conductors: string[];
  openingHymn: HymnReference | null;
  sacramentHymn: HymnReference | null;
  interludeHymn: HymnReference | null;
  closingHymn: HymnReference | null;
  openingPrayer: string | null;
  closingPrayer: string | null;
  speakers: Array<string | null>;
};

export type SundayMeetingTaskCandidate = {
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
  id: string;
  name: string;
  status: string;
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

export function isSundayMeetingType(value: unknown): value is SundayMeetingType {
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

export function isSundayMeetingSection(
  value: unknown,
): value is SundayMeetingSection {
  return (
    typeof value === "string" &&
    (SUNDAY_MEETING_SECTIONS as readonly string[]).includes(value)
  );
}

export function isSundayMeetingStandardSlot(
  value: unknown,
): value is SundayMeetingStandardSlot {
  return (
    typeof value === "string" &&
    (SUNDAY_MEETING_STANDARD_SLOTS as readonly string[]).includes(value)
  );
}

export function isSundayMeetingVisitorRole(
  value: unknown,
): value is SundayMeetingVisitorRole {
  return (
    typeof value === "string" &&
    (VISITOR_ROLES as readonly string[]).includes(value)
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
  ].includes(type);
}

export function itemAllowsRole(
  type: SundayMeetingItemType,
  role: SundayMeetingItemAssignmentRole,
): boolean {
  return ITEM_ROLE_BY_TYPE[type].includes(role);
}
