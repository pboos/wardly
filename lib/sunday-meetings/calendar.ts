import type { SundayMeetingType } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error("Ward time zone must be a valid IANA time zone.");
  }
}

export function parseLocalDate(value: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new Error("Date must use the YYYY-MM-DD format.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date is not a valid calendar date.");
  }

  return date;
}

export function formatLocalDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isSunday(date: string): boolean {
  return parseLocalDate(date).getUTCDay() === 0;
}

export function assertSunday(date: string): void {
  if (!isSunday(date)) {
    throw new Error("A Sunday meeting date must fall on a Sunday.");
  }
}

export function localToday(timeZone: string, now = new Date()): string {
  assertTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");

  if (!year || !month || !day) {
    throw new Error("Could not calculate the ward's local date.");
  }

  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  const result = parseLocalDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return formatLocalDate(result);
}

export function addMonths(date: string, months: number): string {
  const current = parseLocalDate(date);
  const currentDay = current.getUTCDate();
  const monthStart = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months, 1),
  );
  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  );
  monthStart.setUTCDate(Math.min(currentDay, monthEnd.getUTCDate()));
  return formatLocalDate(monthStart);
}

export function sundaysBetween(start: string, end: string): string[] {
  const first = parseLocalDate(start);
  const last = parseLocalDate(end);
  if (first > last) {
    throw new Error("Schedule range start must be before its end.");
  }

  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() + ((7 - cursor.getUTCDay()) % 7));
  const dates: string[] = [];
  while (cursor <= last) {
    dates.push(formatLocalDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dates;
}

export function scheduleRange(
  timeZone: string,
  anchorDate?: string,
): { start: string; end: string; dates: string[] } {
  const anchor = anchorDate ?? localToday(timeZone);
  parseLocalDate(anchor);
  const dates = sundaysBetween(addMonths(anchor, -3), addMonths(anchor, 12));
  const start = dates[0];
  const end = dates.at(-1);
  if (!start || !end) {
    throw new Error("Could not calculate the Sunday schedule range.");
  }
  return { start, end, dates };
}

export function firstSundayOfMonth(date: string): string {
  const current = parseLocalDate(date);
  const first = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1),
  );
  first.setUTCDate(first.getUTCDate() + ((7 - first.getUTCDay()) % 7));
  return formatLocalDate(first);
}

export function secondSundayOfMonth(date: string): string {
  return addDays(firstSundayOfMonth(date), 7);
}

export function isFirstSundayOfMonth(date: string): boolean {
  return date === firstSundayOfMonth(date);
}

export function isSecondSundayOfMonth(date: string): boolean {
  return date === secondSundayOfMonth(date);
}

export function displacesFastAndTestimony(type: SundayMeetingType): boolean {
  return [
    "ward_conference",
    "childrens_sacrament_presentation",
    "stake_conference",
    "general_conference",
  ].includes(type);
}

export function defaultMeetingTypeForSunday(
  date: string,
  firstSundayType: SundayMeetingType | null,
): SundayMeetingType {
  if (isFirstSundayOfMonth(date)) {
    return "fast_testimony";
  }

  if (
    isSecondSundayOfMonth(date) &&
    firstSundayType &&
    displacesFastAndTestimony(firstSundayType)
  ) {
    return "fast_testimony";
  }

  return "sacrament";
}

export function nextSunday(date: string): string {
  assertSunday(date);
  return addDays(date, 7);
}
