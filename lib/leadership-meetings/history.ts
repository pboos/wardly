import "server-only";
import { prisma } from "@/lib/prisma";
import { requestUuid } from "./item-service";
import { dateString, object, text } from "./calendar";
import { itemForWard } from "./store";
import { topicId } from "./topics";
import type { HistoryCursor } from "./types";

export async function loadPreviousMeetingNotes(
  wardId: string,
  input: { itemId: string; cursor: HistoryCursor | null },
) {
  object(input);
  const item = await itemForWard(prisma, wardId, text(input.itemId), false);
  const cursor = input.cursor;
  if (cursor !== null) {
    object(cursor);
    dateString(cursor.date);
    requestUuid(cursor.id);
  }
  const rows = await prisma.meeting_agenda_item.findMany({
    where: {
      meeting: {
        series_id: item.meeting.series_id,
        series: { ward_id: wardId },
        status: { not: "superseded" },
        date: { lt: item.meeting.date },
      },
      outcome: { not: "removed" },
      decision: { not: "" },
      occurrences: { some: { occurrence: { template: { topic_id: topicId(item) } } } },
      ...(cursor ? { OR: [
        { meeting: { date: { lt: cursor.date } } },
        { meeting: { date: cursor.date }, id: { lt: cursor.id } },
      ] } : {}),
    },
    orderBy: [{ meeting: { date: "desc" } }, { id: "desc" }],
    take: 21,
    select: {
      id: true, title: true, outcome: true, decision: true,
      meeting: { select: { date: true } },
    },
  });
  const page = rows.slice(0, 20);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id, date: row.meeting.date, title: row.title,
      outcome: row.outcome, notes: row.decision,
    })),
    nextCursor: rows.length > 20 && last ? { date: last.meeting.date, id: last.id } : null,
  };
}
export type PreviousMeetingNotes = Awaited<ReturnType<typeof loadPreviousMeetingNotes>>;
