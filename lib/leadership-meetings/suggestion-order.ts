import { localToday, parseRule } from "./calendar";
import { SUGGESTIONS, canonicalSuggestionKey } from "./suggestions";
import type { Db } from "./store";

function catalogOrder<T>(rows: T[], key: (row: T) => string) {
  const ranks = new Map(SUGGESTIONS.map((s, index) => [s.key, index]));
  const prayers = rows.filter((row) => key(row) === "prayer");
  const rank = (row: T) =>
    key(row) !== "prayer"
      ? (ranks.get(key(row)) ?? SUGGESTIONS.length)
      : row === prayers[0]
        ? 0
        : row === prayers.at(-1)
          ? SUGGESTIONS.length + 2
          : SUGGESTIONS.length + 1;
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

export async function orderSuggestions(
  db: Db,
  meeting: {
    id: string;
    series_id: string;
    date: string;
    series: { time_zone: string };
  },
) {
  const templates = await db.meeting_agenda_template.findMany({
    where: { series_id: meeting.series_id, archived: false },
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
  });
  const catalog = new Set(SUGGESTIONS.map((s) => s.key));
  const key = (row: (typeof templates)[number]) =>
    canonicalSuggestionKey(row.suggestion_key) ?? "";
  const suggested = templates.filter(
    (t) =>
      catalog.has(key(t)) &&
      parseRule(JSON.parse(t.recurrence)).kind !== "once",
  );
  const sorted = catalogOrder(suggested, key);
  for (const [index, slot] of suggested.entries()) {
    if (sorted[index].position === slot.position) continue;
    await db.meeting_agenda_template.update({
      where: { id: sorted[index].id },
      data: { position: slot.position },
    });
  }
  const templateRanks = new Map(
    sorted.map((template, index) => [template.id, index]),
  );
  const activeKeys = new Map(
    templates.filter((t) => catalog.has(key(t))).map((t) => [t.id, key(t)]),
  );
  const targets = await db.leadership_meeting.findMany({
    where: {
      series_id: meeting.series_id,
      OR: [
        { id: meeting.id },
        {
          status: "planned",
          date: { gt: meeting.date, gte: localToday(meeting.series.time_zone) },
        },
      ],
    },
    include: {
      items: {
        where: { outcome: { not: "removed" } },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        include: { occurrences: { include: { occurrence: true } } },
      },
    },
  });
  for (const target of targets) {
    const itemKey = (row: (typeof target.items)[number]) =>
      row.occurrences
        .map((o) => activeKeys.get(o.occurrence.template_id))
        .find((value) => value !== undefined) ?? "";
    const slots = target.items.filter(
      (row) => row.outcome === "pending" && !row.predecessor_id && itemKey(row),
    );
    const templateRank = (row: (typeof slots)[number]) =>
      Math.min(
        ...row.occurrences.map(
          (o) => templateRanks.get(o.occurrence.template_id) ?? Infinity,
        ),
      );
    const ordered = catalogOrder(
      [...slots].sort((a, b) => templateRank(a) - templateRank(b)),
      itemKey,
    );
    for (const [index, slot] of slots.entries()) {
      if (ordered[index].position === slot.position) continue;
      await db.meeting_agenda_item.update({
        where: { id: ordered[index].id },
        data: { position: slot.position },
      });
    }
  }
}
