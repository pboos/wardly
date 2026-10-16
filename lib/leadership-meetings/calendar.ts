export type CalendarRule =
  | { version: 1; kind: "once" }
  | { version: 1; kind: "every_meeting" }
  | { version: 1; kind: "weeks"; interval: number; weekday: number }
  | { version: 1; kind: "months"; interval: number; day: number }
  | {
      version: 1;
      kind: "ordinal";
      interval: number;
      weekday: number;
      ordinal: number;
    }
  | { version: 1; kind: "annual"; month: number; day: number };

export function dateString(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value ||
    value < "2000-01-01" ||
    value > "2100-12-31"
  )
    throw new Error("Choose a valid date between 2000 and 2100.");
  return value;
}
export function integer(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error(`Enter a whole number between ${min} and ${max}.`);
  return value;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid input.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`Enter text of at most ${max} characters.`);
  return value.trim();
}
function ordinal(value: unknown): number {
  const n = integer(value, -1, 5);
  if (n === 0) throw new Error("Choose first through fifth, or last.");
  return n;
}
export function parseRule(value: unknown): CalendarRule {
  const r = object(value);
  if (r.version !== 1) throw new Error("Unsupported recurrence version.");
  switch (r.kind) {
    case "once":
    case "every_meeting":
      return { version: 1, kind: r.kind };
    case "weeks":
      return {
        version: 1,
        kind: r.kind,
        interval: integer(r.interval, 1, 52),
        weekday: integer(r.weekday, 0, 6),
      };
    case "months":
      return {
        version: 1,
        kind: r.kind,
        interval: integer(r.interval, 1, 24),
        day: integer(r.day, 1, 31),
      };
    case "ordinal":
      return {
        version: 1,
        kind: r.kind,
        interval: integer(r.interval, 1, 24),
        weekday: integer(r.weekday, 0, 6),
        ordinal: ordinal(r.ordinal),
      };
    case "annual":
      return {
        version: 1,
        kind: r.kind,
        month: integer(r.month, 1, 12),
        day: integer(r.day, 1, 31),
      };
    default:
      throw new Error("Unknown recurrence.");
  }
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function localToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function monthDays(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
export function matches(
  rule: CalendarRule,
  anchor: string,
  date: string,
): boolean {
  if (date < anchor) return false;
  const d = new Date(`${date}T12:00:00Z`),
    a = new Date(`${anchor}T12:00:00Z`);
  const monthOffset =
    (d.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    d.getUTCMonth() -
    a.getUTCMonth();
  const days = monthDays(d.getUTCFullYear(), d.getUTCMonth());
  switch (rule.kind) {
    case "once":
      return date === anchor;
    case "every_meeting":
      return false;
    case "weeks": {
      const first = addDays(anchor, (rule.weekday - a.getUTCDay() + 7) % 7);
      const week = Math.floor(
        (d.getTime() - new Date(`${first}T12:00:00Z`).getTime()) / 604800000,
      );
      return (
        date >= first &&
        d.getUTCDay() === rule.weekday &&
        week % rule.interval === 0
      );
    }
    case "months":
      return (
        monthOffset % rule.interval === 0 &&
        d.getUTCDate() === Math.min(rule.day, days)
      );
    case "annual":
      return (
        d.getUTCMonth() + 1 === rule.month &&
        d.getUTCDate() === Math.min(rule.day, days)
      );
    case "ordinal":
      return (
        monthOffset % rule.interval === 0 &&
        d.getUTCDay() === rule.weekday &&
        (rule.ordinal === -1
          ? d.getUTCDate() + 7 > days
          : Math.ceil(d.getUTCDate() / 7) === rule.ordinal)
      );
  }
}
export function datesBetween(
  rule: CalendarRule,
  anchor: string,
  from: string,
  to: string,
): string[] {
  if (new Date(to).getTime() - new Date(from).getTime() > 366 * 12 * 86400000)
    throw new Error("Date range is too large.");
  const result: string[] = [];
  for (
    let date = from < anchor ? anchor : from;
    date <= to;
    date = addDays(date, 1)
  ) {
    if (matches(rule, anchor, date)) result.push(date);
  }
  return result;
}
export type ScheduledDate = { id: string; date: string; status: string };
export function assignMeeting(
  due: string,
  meetings: ScheduledDate[],
): ScheduledDate | undefined {
  const available = meetings
    .filter((m) => m.status !== "cancelled" && m.status !== "superseded")
    .sort((a, b) => a.date.localeCompare(b.date));
  const before = available.filter((m) => m.date <= due).at(-1);
  if (before?.status === "planned") return before;
  return available.find((m) => m.date > due && m.status === "planned");
}
export function ruleLabel(rule: CalendarRule): string {
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  switch (rule.kind) {
    case "once":
      return "One-time";
    case "every_meeting":
      return "Every meeting";
    case "weeks":
      return `Every ${rule.interval} week(s), ${weekdays[rule.weekday]}`;
    case "months":
      return `Every ${rule.interval} month(s), day ${rule.day}`;
    case "ordinal":
      return `Every ${rule.interval} month(s), ${rule.ordinal === -1 ? "last" : rule.ordinal} ${weekdays[rule.weekday]}`;
    case "annual":
      return `Yearly, ${rule.month}/${rule.day}`;
  }
}
