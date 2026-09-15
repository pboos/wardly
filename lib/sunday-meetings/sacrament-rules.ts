import type { SundayMeetingItemType } from "./types.ts";
import { fail, type ResolvedPerson, type Transaction } from "./rules.ts";

export async function assertSacramentCapacity(
  tx: Transaction,
  meetingId: string,
  type: SundayMeetingItemType,
  person: ResolvedPerson,
  excludeId?: string,
) {
  if (type !== "sacrament_blessing" || (!person.memberId && !person.personName))
    return;
  const count = await tx.sunday_meeting_item.count({
    where: {
      sunday_meeting_id: meetingId,
      type,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [{ person_member_id: { not: null } }, { person_name: { not: null } }],
    },
  });
  if (count >= 2) fail("Blessing the sacrament allows at most two people.");
}
