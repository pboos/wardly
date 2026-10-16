import type { Db } from "./store";
import { meetingForWard } from "./store";
import { localToday, parseRule } from "./calendar";

export async function activeTemplates(db: Db, seriesId: string) {
  const templates = await db.meeting_agenda_template.findMany({
    where: { series_id: seriesId, archived: false },
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
  });
  return templates.filter(
    (t) => parseRule(JSON.parse(t.recurrence)).kind !== "once",
  );
}

export async function nextTemplatePosition(db: Db, seriesId: string) {
  const result = await db.meeting_agenda_template.aggregate({
    where: { series_id: seriesId },
    _max: { position: true },
  });
  return (result._max.position ?? -1) + 1;
}

export async function insertionPosition(
  db: Db,
  meetingId: string,
  occurrenceIds: string[],
  excludedId?: string,
) {
  const meeting = await db.leadership_meeting.findUniqueOrThrow({
    where: { id: meetingId },
  });
  const templates = await activeTemplates(db, meeting.series_id);
  const ranks = new Map(templates.map((t, index) => [t.id, index]));
  const occurrences = await db.meeting_agenda_occurrence.findMany({
    where: { id: { in: occurrenceIds } },
  });
  const rank = Math.min(
    ...occurrences.flatMap((o) =>
      ranks.has(o.template_id) ? [ranks.get(o.template_id)!] : [],
    ),
  );
  const rows = await db.meeting_agenda_item.findMany({
    where: {
      meeting_id: meetingId,
      ...(excludedId ? { id: { not: excludedId } } : {}),
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: { occurrences: { include: { occurrence: true } } },
  });
  const index = Number.isFinite(rank)
    ? rows.findIndex(
        (row) =>
          row.outcome === "pending" &&
          row.occurrences.some(
            (o) => (ranks.get(o.occurrence.template_id) ?? -1) > rank,
          ),
      )
    : -1;
  const position =
    index < 0 ? (rows.at(-1)?.position ?? -1) + 1 : rows[index].position;
  if (index >= 0)
    await db.meeting_agenda_item.updateMany({
      where: {
        meeting_id: meetingId,
        position: { gte: position },
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      data: { position: { increment: 1 } },
    });
  return position;
}

export async function saveFutureOrder(
  db: Db,
  wardId: string,
  meetingId: string,
  itemIds: string[],
) {
  const meeting = await meetingForWard(db, wardId, meetingId);
  const rows = await db.meeting_agenda_item.findMany({
    where: { meeting_id: meetingId, outcome: { not: "removed" } },
    include: { occurrences: { include: { occurrence: true } } },
  });
  if (
    !Array.isArray(itemIds) ||
    itemIds.length !== rows.length ||
    new Set(itemIds).size !== rows.length ||
    rows.some((r) => !itemIds.includes(r.id))
  )
    throw new Error(
      "The agenda changed. Refresh before saving its future order.",
    );
  const templates = await activeTemplates(db, meeting.series_id);
  const active = new Set(templates.map((t) => t.id));
  const represented = [
    ...new Set(
      itemIds.flatMap((id) =>
        rows
          .find((r) => r.id === id)!
          .occurrences.map((o) => o.occurrence.template_id)
          .filter((id) => active.has(id)),
      ),
    ),
  ];
  if (represented.length < 2)
    throw new Error(
      "Choose at least two recurring items to save their future order.",
    );
  const representedSet = new Set(represented);
  let index = 0;
  const ordered = templates.map((t) =>
    representedSet.has(t.id) ? represented[index++] : t.id,
  );
  for (const [position, id] of ordered.entries())
    await db.meeting_agenda_template.update({
      where: { id },
      data: { position },
    });
  const ranks = new Map(ordered.map((id, position) => [id, position]));
  const future = await db.leadership_meeting.findMany({
    where: {
      series_id: meeting.series_id,
      status: "planned",
      date: { gt: meeting.date, gte: localToday(meeting.series.time_zone) },
    },
    include: {
      items: {
        where: { outcome: { not: "removed" } },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        include: { occurrences: { include: { occurrence: true } } },
      },
    },
  });
  for (const target of future) {
    const rank = (row: (typeof target.items)[number]) =>
      Math.min(
        ...row.occurrences.flatMap((o) =>
          ranks.has(o.occurrence.template_id)
            ? [ranks.get(o.occurrence.template_id)!]
            : [],
        ),
      );
    const recurring = target.items
      .filter((row) => row.outcome === "pending" && Number.isFinite(rank(row)))
      .sort((a, b) => rank(a) - rank(b));
    const eligible = new Set(recurring.map((r) => r.id));
    let slot = 0;
    for (const row of target.items)
      if (eligible.has(row.id)) {
        await db.meeting_agenda_item.update({
          where: { id: recurring[slot++].id },
          data: { position: row.position },
        });
      }
  }
}
