import { parseRule } from "./calendar";
import { canonicalSuggestionKey } from "./suggestions";
import type { Db } from "./store";

export async function suggestionState(
  db: Db,
  seriesId: string,
  meetingId?: string,
) {
  const templates = await db.meeting_agenda_template.findMany({
    where: {
      series_id: seriesId,
      archived: false,
      suggestion_key: { not: null },
    },
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
    include: {
      occurrences: {
        include: {
          appearances: { include: { item: { include: { meeting: true } } } },
        },
      },
    },
  });
  return templates
    .filter(
      (template) =>
        parseRule(JSON.parse(template.recurrence)).kind !== "once" ||
        template.occurrences.some(
          (o) =>
            o.status === "pending" ||
            (o.status === "removed" &&
              o.appearances.some((a) =>
                ["planned", "active"].includes(a.item.meeting.status),
              )),
        ),
    )
    .flatMap((template) => {
      const current = [
        ...new Map(
          template.occurrences
            .flatMap((o) => o.appearances)
            .filter((a) => a.item.meeting_id === meetingId)
            .map((a) => [a.item.id, a.item]),
        ).values(),
      ];
      const appearances = current.length ? current : [null];
      return appearances.map((item) => ({
        templateId: template.id,
        key: canonicalSuggestionKey(template.suggestion_key) ?? "",
        title: item?.title ?? template.title,
        durationMinutes: item?.duration_minutes ?? template.duration_minutes,
        recurrence: parseRule(JSON.parse(template.recurrence)),
        restoreItemId: item?.outcome === "removed" ? item.id : null,
        onAgenda: !!item && item.outcome !== "removed",
      }));
    });
}
