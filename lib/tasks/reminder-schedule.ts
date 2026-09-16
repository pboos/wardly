import { addDays, isSunday, localToday } from "@/lib/sunday-meetings/calendar";

export function isMeetingTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Resolve a wall-clock time using the offsets on either side of a DST change.
// A repeated time uses its first occurrence; a nonexistent time is skipped.
export function meetingInstant(
  date: string,
  time: string,
  timeZone: string,
): number | null {
  if (!isMeetingTime(time) || !isIanaTimeZone(timeZone)) return null;
  const nominal = Date.parse(`${date}T${time}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const wallTime = (instant: number) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(instant).map((p) => [p.type, p.value]),
    );
    return Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
    );
  };
  const candidates = [-86400000, 0, 86400000]
    .map((delta) => {
      const sample = nominal + delta;
      return nominal - (wallTime(sample) - sample);
    })
    .filter((candidate) => wallTime(candidate) === nominal);
  return candidates.length ? Math.min(...candidates) : null;
}

export function dueSunday(
  timeZone: string,
  time: string | null,
  now: Date,
): string | null {
  if (!time || !isMeetingTime(time) || !isIanaTimeZone(timeZone)) return null;
  const today = localToday(timeZone, now);
  // Include tomorrow for meetings shortly after midnight on Sunday.
  for (const date of [today, addDays(today, 1)]) {
    if (!isSunday(date)) continue;
    const meeting = meetingInstant(date, time, timeZone);
    if (
      meeting !== null &&
      now.getTime() >= meeting - 3600000 &&
      now.getTime() < meeting
    )
      return date;
  }
  return null;
}
