import { ruleLabel, type CalendarRule } from "./calendar";
import type { MeetingKind } from "./types";
const handbook =
  "https://www.churchofjesuschrist.org/study/manual/general-handbook/";
export type Suggestion = {
  key: string;
  repeatable?: boolean;
  supportsTasks?: boolean;
  title: string;
  detail: string;
  duration: number;
  recurrence: CalendarRule;
  source: string;
  reference: string;
  frequency: "Suggested rhythm" | "Handbook frequency";
  kinds: MeetingKind[];
};
const both: MeetingKind[] = ["bishopric", "ward_council"];
const every: CalendarRule = { version: 1, kind: "every_meeting" };
const monthly: CalendarRule = {
  version: 1,
  kind: "months",
  interval: 1,
  day: 15,
};
const quarter: CalendarRule = {
  version: 1,
  kind: "months",
  interval: 3,
  day: 10,
};
const annual: CalendarRule = { version: 1, kind: "annual", month: 11, day: 1 };
export const SUGGESTIONS: Suggestion[] = [
  {
    key: "prayer",
    supportsTasks: false,
    repeatable: true,
    title: "Prayer",
    detail:
      "Invite someone to offer a prayer. Meetings may begin and end with prayer.",
    duration: 1,
    recurrence: every,
    source: "29-meetings-in-the-church",
    reference: "29.6",
    frequency: "Suggested rhythm",
    kinds: both,
  },
  {
    key: "spiritual-thought",
    supportsTasks: false,
    title: "Spiritual thought",
    detail: "Share a brief gospel thought to prepare to counsel together.",
    duration: 2,
    recurrence: every,
    source: "29-meetings-in-the-church",
    reference: "29.2.4–29.2.5",
    frequency: "Suggested rhythm",
    kinds: both,
  },
  {
    key: "assignments",
    title: "Previous decisions and assignments",
    detail: "Review progress and unblock assigned work.",
    duration: 5,
    recurrence: every,
    source: "4-leadership-in-the-church-of-jesus-christ",
    reference: "4.4",
    frequency: "Suggested rhythm",
    kinds: both,
  },
  {
    key: "upcoming-sundays",
    title: "Upcoming Sundays",
    detail:
      "Coordinate upcoming Sunday meetings, teaching, and organization responsibilities.",
    duration: 5,
    recurrence: every,
    source: "29-meetings-in-the-church",
    reference: "29.2.4–29.2.5",
    frequency: "Suggested rhythm",
    kinds: both,
  },
  {
    key: "youth",
    title: "Children and youth",
    detail:
      "Identify individuals needing support, ordinance preparation, and missionary preparation.",
    duration: 10,
    recurrence: every,
    source: "7",
    reference: "7.1–7.2",
    frequency: "Suggested rhythm",
    kinds: ["bishopric"],
  },
  {
    key: "council-youth",
    title: "Children, youth, and gospel learning",
    detail:
      "Coordinate support across organizations and address teaching needs that benefit from the whole council.",
    duration: 10,
    recurrence: monthly,
    source: "29-meetings-in-the-church",
    reference: "29.2.5",
    frequency: "Suggested rhythm",
    kinds: ["ward_council"],
  },
  {
    key: "people",
    title: "Individuals and families needing coordinated help",
    detail:
      "Choose the next action and an owner. Avoid confidential counseling details.",
    duration: 10,
    recurrence: every,
    source: "29-meetings-in-the-church",
    reference: "29.2.4–29.2.5",
    frequency: "Suggested rhythm",
    kinds: both,
  },
  {
    key: "callings",
    title: "Callings",
    detail: "Counsel about needed callings and releases, and assign follow-up.",
    duration: 8,
    recurrence: every,
    source: "29-meetings-in-the-church",
    reference: "29.2.4",
    frequency: "Suggested rhythm",
    kinds: ["bishopric"],
  },
  {
    key: "ordinances",
    title: "Ordinances",
    detail:
      "Review ordinance preparation and assign needed follow-up. Keep confidential counseling details private.",
    duration: 5,
    recurrence: every,
    source: "29-meetings-in-the-church",
    reference: "29.2.4",
    frequency: "Suggested rhythm",
    kinds: ["bishopric"],
  },
  {
    key: "finance",
    title: "Confirm monthly financial review",
    detail:
      "The bishop and clerk review statements monthly. Discuss exceptions here; this agenda does not replace their review. The 15th is an editable suggested date.",
    duration: 5,
    recurrence: monthly,
    source: "34-finances-and-audits",
    reference: "34.2",
    frequency: "Handbook frequency",
    kinds: ["bishopric"],
  },
  {
    key: "report",
    title: "Quarterly Report preparation",
    detail:
      "Review with the clerk before submission. Choose a date early enough for corrections before the 15th after each quarter.",
    duration: 5,
    recurrence: quarter,
    source: "33-records-and-reports",
    reference: "33.5.1.3",
    frequency: "Handbook frequency",
    kinds: ["bishopric"],
  },
  {
    key: "ministering",
    title: "Quarterly ministering coordination follow-up",
    detail:
      "Arrange and follow up on the separate quarterly meetings with elders quorum and Relief Society presidents.",
    duration: 8,
    recurrence: quarter,
    source: "21-ministering",
    reference: "21.3–21.4",
    frequency: "Handbook frequency",
    kinds: ["bishopric"],
  },
  {
    key: "budget",
    title: "Annual budget preparation",
    detail:
      "Prepare the annual budget with organization leaders and agree priorities and resources.",
    duration: 15,
    recurrence: annual,
    source: "34-finances-and-audits",
    reference: "34.6.1",
    frequency: "Suggested rhythm",
    kinds: ["bishopric"],
  },
  {
    key: "annual-calendar",
    title: "Annual calendar preparation",
    detail:
      "Coordinate the coming year’s activities with organization leaders and assign preparation responsibilities.",
    duration: 10,
    recurrence: annual,
    source: "20-activities",
    reference: "20.2.5",
    frequency: "Suggested rhythm",
    kinds: both,
  },
  {
    key: "tithing",
    title: "Tithing declaration arrangements",
    detail: "Prepare the annual arrangements and assignments.",
    duration: 8,
    recurrence: { ...annual, month: 8, day: 15 },
    source: "34-finances-and-audits",
    reference: "34.3",
    frequency: "Suggested rhythm",
    kinds: ["bishopric"],
  },
  {
    key: "audit",
    title: "Financial audit follow-up",
    detail:
      "Prepare for twice-yearly audits and resolve corrections. Adjust the suggested dates locally.",
    duration: 8,
    recurrence: { ...monthly, interval: 6 },
    source: "34-finances-and-audits",
    reference: "34.7",
    frequency: "Handbook frequency",
    kinds: ["bishopric"],
  },
  {
    key: "gospel",
    title: "Sharing the gospel and strengthening members",
    detail:
      "Coordinate support for people being taught and new or returning members. The Handbook calls for regular discussion; weekly is a suggestion.",
    duration: 10,
    recurrence: every,
    source: "23",
    reference: "23.6.5–23.6.6",
    frequency: "Suggested rhythm",
    kinds: ["ward_council"],
  },
  {
    key: "temple",
    title: "Temple and family history plan",
    detail: "Report progress, identify needed support, and update actions.",
    duration: 8,
    recurrence: monthly,
    source: "25-temple-and-family-history-work",
    reference: "25.2.6",
    frequency: "Suggested rhythm",
    kinds: ["ward_council"],
  },
  {
    key: "self-reliance",
    title: "Self-reliance, service, and preparedness",
    detail:
      "Coordinate employment, education, and practical support across organizations.",
    duration: 8,
    recurrence: monthly,
    source: "22-providing-for-temporal-needs",
    reference: "22",
    frequency: "Suggested rhythm",
    kinds: ["ward_council"],
  },
  {
    key: "priorities",
    title: "Review local priorities and ward plans",
    detail:
      "Use useful report insights and ministering needs to adjust support. Focus on matters needing combined effort.",
    duration: 10,
    recurrence: quarter,
    source: "29-meetings-in-the-church",
    reference: "29.2.5",
    frequency: "Suggested rhythm",
    kinds: ["ward_council"],
  },
  {
    key: "presentation",
    title: "Primary presentation preparation",
    detail:
      "Coordinate an annual presentation with the Primary presidency and assign preparation. Choose the local date.",
    duration: 8,
    recurrence: { ...annual, month: 9, day: 1 },
    source: "12-primary",
    reference: "12.1.6",
    frequency: "Suggested rhythm",
    kinds: ["bishopric"],
  },
  {
    key: "conference",
    title: "Ward or branch conference preparation",
    detail:
      "Prepare with stake leaders and adjust this suggested date to the conference schedule.",
    duration: 8,
    recurrence: { ...annual, month: 1, day: 15 },
    source: "29-meetings-in-the-church",
    reference: "29.2.3",
    frequency: "Suggested rhythm",
    kinds: both,
  },
  {
    key: "annual-plans",
    title: "Refresh plans and major activities",
    detail: "Coordinate the coming year's priorities and preparation.",
    duration: 15,
    recurrence: annual,
    source: "4-leadership-in-the-church-of-jesus-christ",
    reference: "4.4",
    frequency: "Suggested rhythm",
    kinds: ["ward_council"],
  },
];
export function sourceUrl(suggestion: Suggestion) {
  return `${handbook}${suggestion.source}?lang=eng`;
}

export function canonicalSuggestionKey(key: string | null) {
  return key === "opening" || key === "closing" ? "prayer" : key;
}
export function suggestionsForKind(kind: MeetingKind) {
  return SUGGESTIONS.filter((suggestion) => suggestion.kinds.includes(kind));
}
export function suggestionAnchor(key: string, date: string) {
  if (key !== "report") return date;
  const anchor = new Date(`${date}T12:00:00Z`);
  anchor.setUTCDate(10);
  anchor.setUTCMonth(Math.ceil(anchor.getUTCMonth() / 3) * 3);
  if (anchor.toISOString().slice(0, 10) < date)
    anchor.setUTCMonth(anchor.getUTCMonth() + 3);
  return anchor.toISOString().slice(0, 10);
}

export function suggestionInstructions(suggestion: Suggestion) {
  return `${suggestion.detail}\n\n${suggestion.frequency}: ${ruleLabel(suggestion.recurrence)}. Edit the schedule to control which meetings this topic appears in.\n\n[General Handbook ${suggestion.reference}](${sourceUrl(suggestion)})`;
}
