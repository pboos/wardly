import { standardAgendaForMeeting } from "./templates.ts";
import { isItemDataEmpty, nextPosition } from "./order.ts";
import { asItemType } from "./rules.ts";
import { parseItemMetadata } from "./types.ts";
import {
  meetingSortableItems,
  normalizeMeetingOrder,
} from "./order-service.ts";
import type { Transaction } from "./rules.ts";
import type { SundayMeetingType } from "./types.ts";

/** Reconcile meeting-type defaults without discarding entered data or custom order. */
export async function syncStandardItems(
  tx: Transaction,
  meetingId: string,
  type: SundayMeetingType,
) {
  const expected = standardAgendaForMeeting(type);
  const existing = await tx.sunday_meeting_item.findMany({
    where: { sunday_meeting_id: meetingId },
  });
  for (const item of existing) {
    if (!item.slot || expected.some((entry) => entry.slot === item.slot))
      continue;
    const empty = isItemDataEmpty({
      type: asItemType(item.type),
      content: item.content,
      metadata: parseItemMetadata(item.metadata),
      personMemberId: item.person_member_id,
      personName: item.person_name,
    });
    if (empty && !item.task_id)
      await tx.sunday_meeting_item.delete({ where: { id: item.id } });
    else
      await tx.sunday_meeting_item.update({
        where: { id: item.id },
        data: { slot: null },
      });
  }
  const items = await meetingSortableItems(tx, meetingId);
  for (const entry of expected) {
    if (items.some((item) => item.slot === entry.slot)) continue;
    const orderIndex = nextPosition(items, entry.section);
    const created = await tx.sunday_meeting_item.create({
      data: {
        sunday_meeting_id: meetingId,
        slot: entry.slot,
        type: entry.type,
        section: entry.section,
        order_index: orderIndex,
      },
    });
    items.push({
      id: created.id,
      type: entry.type,
      section: entry.section,
      slot: entry.slot,
      orderIndex,
      createdAt: created.created_at.toISOString(),
    });
  }
  await normalizeMeetingOrder(tx, meetingId);
}
