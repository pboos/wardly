import { prisma } from "@/lib/prisma";
import { isLocalMeetingType, isSundayMeetingSection } from "./types.ts";
import {
  moveAgendaItems,
  renumberItems,
  sortSundayItems,
  type OrderedItem,
  type SundayAgendaMove,
} from "./order.ts";
import {
  asMeetingType,
  assertNoAdjacentConductorText,
  fail,
  meetingItems,
  requireItem,
  sortableList,
  type Transaction,
} from "./rules.ts";

export async function meetingSortableItems(tx: Transaction, meetingId: string) {
  return sortableList(await meetingItems(tx, meetingId));
}

export async function saveItemOrder(
  tx: Transaction,
  items: readonly OrderedItem[],
) {
  for (const item of items) {
    await tx.sunday_meeting_item.update({
      where: { id: item.id },
      data: {
        section: item.section,
        order_index: item.orderIndex,
        updated_at: new Date(),
      },
    });
  }
}

export async function normalizeMeetingOrder(
  tx: Transaction,
  meetingId: string,
) {
  const items = sortSundayItems(await meetingSortableItems(tx, meetingId));
  assertNoAdjacentConductorText(items);
  await saveItemOrder(tx, renumberItems(items));
}

export type MoveSundayItemInput = SundayAgendaMove;

export async function moveSundayItem(
  wardId: string,
  itemId: string,
  input: MoveSundayItemInput,
): Promise<void> {
  if (
    typeof input.showSupportText !== "boolean" ||
    (input.direction !== undefined
      ? !["up", "down"].includes(input.direction) || input.section !== undefined
      : !isSundayMeetingSection(input.section))
  )
    fail("Invalid agenda move.");
  await prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    if (!isLocalMeetingType(asMeetingType(item.sunday_meeting.type)))
      fail("Conference meetings do not have a local agenda.");
    const items = await meetingSortableItems(tx, item.sunday_meeting_id);
    const moved = moveAgendaItems(items, itemId, input);
    if (!moved) fail("This entry cannot move to that position.");
    assertNoAdjacentConductorText(moved);
    await saveItemOrder(
      tx,
      moved.filter((entry) => {
        const before = items.find((candidate) => candidate.id === entry.id);
        return (
          before?.section !== entry.section ||
          before.orderIndex !== entry.orderIndex
        );
      }),
    );
  });
}
