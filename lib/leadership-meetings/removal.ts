import { localToday } from "./calendar";
import { itemForWard, seriesForWard, type Db } from "./store";

export async function removeAgenda(
  db: Db,
  wardId: string,
  itemId: string,
  scope: "this" | "future",
) {
  if (scope !== "this" && scope !== "future")
    throw new Error("Choose a removal scope.");
  const item = await itemForWard(db, wardId, itemId);
  if (!["pending", "removed"].includes(item.outcome))
    throw new Error("Only pending items can be removed.");
  const templateIds = item.occurrences.map((o) => o.occurrence.template_id);
  const series = await seriesForWard(db, wardId, item.meeting.series_id);
  if (scope === "future")
    await db.meeting_agenda_template.updateMany({
      where: { id: { in: templateIds }, series_id: series.id },
      data: { archived: true, updated_at: new Date() },
    });
  const rows =
    scope === "this"
      ? [item]
      : await db.meeting_agenda_item.findMany({
          where: {
            outcome: { in: ["pending", "removed"] },
            OR: [
              { id: item.id },
              {
                meeting: {
                  series_id: series.id,
                  status: { in: ["planned", "active"] },
                  date: {
                    gt: item.meeting.date,
                    gte: localToday(series.time_zone),
                  },
                },
              },
            ],
            occurrences: {
              some: { occurrence: { template_id: { in: templateIds } } },
            },
          },
          include: { occurrences: true },
        });
  await db.meeting_agenda_item.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { outcome: "removed", updated_at: new Date() },
  });
  const occurrenceIds = [
    ...new Set(rows.flatMap((r) => r.occurrences.map((o) => o.occurrence_id))),
  ];
  for (const id of occurrenceIds) {
    const surviving = await db.meeting_agenda_item_occurrence.count({
      where: { occurrence_id: id, item: { outcome: { not: "removed" } } },
    });
    if (!surviving)
      await db.meeting_agenda_occurrence.update({
        where: { id },
        data: { status: "removed", updated_at: new Date() },
      });
  }
}
