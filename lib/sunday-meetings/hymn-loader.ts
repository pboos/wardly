import { prisma } from "@/lib/prisma";
import { loadHymnCatalog } from "../hymns/index.ts";
import { localToday } from "./calendar.ts";
import { buildHymnHistory, type SundayHymnData } from "./hymns.ts";

export async function loadSundayHymns(
  wardId: string,
  locale: string,
  timeZone: string,
): Promise<SundayHymnData> {
  const today = localToday(timeZone);
  const [catalog, items] = await Promise.all([
    loadHymnCatalog(locale),
    prisma.sunday_meeting_item.findMany({
      where: {
        type: "hymn",
        sunday_meeting: { ward_id: wardId, date: { lt: today } },
      },
      select: { metadata: true, sunday_meeting: { select: { date: true } } },
    }),
  ]);
  return {
    hymns: catalog?.hymns ?? [],
    lastSung: buildHymnHistory(items, today),
  };
}
