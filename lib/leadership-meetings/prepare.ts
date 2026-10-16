import "server-only";
import { prisma } from "@/lib/prisma";
import { reconcile } from "./store";
import type { MeetingKind } from "./types";

export async function prepareLeadershipMeetings(
  wardId: string,
  kind: MeetingKind,
) {
  await prisma.$transaction(
    async (db) => {
      const series = await db.leadership_meeting_series.findUnique({
        where: { ward_id_kind: { ward_id: wardId, kind } },
      });
      if (series) await reconcile(db, series.id);
    },
    { timeout: 30000 },
  );
}
