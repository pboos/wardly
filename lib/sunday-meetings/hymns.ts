import type { Hymn } from "../hymns/index.ts";
import { parseItemMetadata } from "./types.ts";

export type SundayHymnData = {
  hymns: readonly Hymn[];
  lastSung: Record<number, string>;
};

export function buildHymnHistory(
  items: readonly {
    metadata: string | null;
    sunday_meeting: { date: string };
  }[],
  today: string,
): Record<number, string> {
  const result: Record<number, string> = {};
  for (const item of items) {
    const number = parseItemMetadata(item.metadata)?.hymnNumber;
    const date = item.sunday_meeting.date;
    if (number && date < today && (!result[number] || date > result[number]))
      result[number] = date;
  }
  return result;
}

export function hymnChoices(
  hymns: readonly Hymn[],
  query: string,
): readonly Hymn[] {
  const value = query.trim();
  if (!/^\d+$/.test(value)) return [];
  return hymns
    .filter((hymn) => String(hymn.number).startsWith(String(Number(value))))
    .sort(
      (a, b) =>
        Number(b.number === Number(value)) -
          Number(a.number === Number(value)) || a.number - b.number,
    );
}
