import { prisma } from "@/lib/prisma";
import {
  isLocalMeetingType,
  isSundayMeetingItemType,
  isSundayMeetingSection,
  isSundayMeetingTaskItemType,
  parseItemMetadata,
  type SundayItemMetadata,
  type SundayMeetingItemType,
  type SundayPersonInput,
} from "./types.ts";
import { isAutoDeletableItem } from "./order.ts";
import { isStandardSlot, slotAllowsItemType } from "./templates.ts";
import {
  asItemType,
  asMeetingType,
  asSection,
  assertHymnNumber,
  assertNoAdjacentConductorText,
  assertSinglePersonItemType,
  assertTransitionEmpty,
  fail,
  MAX_ITEM_TEXT_LENGTH,
  requireItem,
  requirePersonMember,
  resolvePersonInput,
  serializeMetadata,
  trimmedOrNullCapped,
  type ResolvedPerson,
  type Transaction,
} from "./rules.ts";
import {
  meetingSortableItems,
  normalizeMeetingOrder,
} from "./order-service.ts";

export type UpdateSundayItemInput = {
  content?: string | null;
  metadata?: SundayItemMetadata | null;
  person?: SundayPersonInput | null;
  type?: SundayMeetingItemType;
};

export async function updateSundayItemInTransaction(
  tx: Transaction,
  wardId: string,
  itemId: string,
  input: UpdateSundayItemInput,
): Promise<void> {
  const item = await requireItem(tx, wardId, itemId);
  if (!isLocalMeetingType(asMeetingType(item.sunday_meeting.type))) {
    fail("Conference meetings do not have a local agenda.");
  }

  const currentType = asItemType(item.type);
  const currentSection = asSection(item.section);
  const targetType = input.type ?? currentType;
  const targetSection = currentSection;
  if (
    item.slot &&
    (!isStandardSlot(item.slot) || !slotAllowsItemType(item.slot, targetType))
  ) {
    fail("A standard slot must keep its item type.");
  }
  if (
    !isSundayMeetingItemType(targetType) ||
    !isSundayMeetingSection(targetSection)
  ) {
    fail("Invalid agenda item.");
  }
  if (isSundayMeetingTaskItemType(targetType) && !item.task_id) {
    fail("Task presentation items must be added from a suggested task.");
  }
  if (item.task_id && targetType !== currentType) {
    fail("A task-linked item must keep its task presentation type.");
  }
  if (
    (targetType === "leader" || targetType === "presiding") &&
    targetType !== currentType
  ) {
    await assertSinglePersonItemType(
      tx,
      item.sunday_meeting_id,
      targetType,
      itemId,
    );
  }

  const content =
    input.content === undefined
      ? item.content
      : trimmedOrNullCapped(input.content, MAX_ITEM_TEXT_LENGTH, "Item text");
  const metadata =
    input.metadata === undefined
      ? parseItemMetadata(item.metadata)
      : (input.metadata ?? null);
  const metadataRaw = serializeMetadata(metadata);
  const person: ResolvedPerson =
    input.person === undefined
      ? { memberId: item.person_member_id, personName: item.person_name }
      : resolvePersonInput(input.person);
  if (person.memberId && person.memberId !== item.person_member_id) {
    await requirePersonMember(tx, wardId, person.memberId);
  }
  assertHymnNumber(metadata);
  assertTransitionEmpty(targetType, content, metadataRaw, person);

  const items = await meetingSortableItems(tx, item.sunday_meeting_id);

  // Empty extra rows disappear. Standard slots, transitions and task links remain.
  if (
    isAutoDeletableItem({
      slot: item.slot,
      type: targetType,
      content,
      metadata,
      personMemberId: person.memberId,
      personName: person.personName,
      taskId: item.task_id,
    })
  ) {
    assertNoAdjacentConductorText(
      items.filter((candidate) => candidate.id !== itemId),
    );
    await tx.sunday_meeting_item.delete({ where: { id: itemId } });
    await normalizeMeetingOrder(tx, item.sunday_meeting_id);
    return;
  }

  assertNoAdjacentConductorText(
    items.map((candidate) =>
      candidate.id === itemId
        ? { ...candidate, type: targetType, section: targetSection }
        : candidate,
    ),
  );

  await tx.sunday_meeting_item.update({
    where: { id: itemId },
    data: {
      type: targetType,
      section: targetSection,
      content,
      metadata: metadataRaw,
      person_member_id: person.memberId,
      person_name: person.personName,
      updated_at: new Date(),
    },
  });
}

export async function updateSundayItem(
  wardId: string,
  itemId: string,
  input: UpdateSundayItemInput,
): Promise<void> {
  await prisma.$transaction((tx) =>
    updateSundayItemInTransaction(tx, wardId, itemId, input),
  );
}

export async function deleteSundayItem(
  wardId: string,
  itemId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    if (!isLocalMeetingType(asMeetingType(item.sunday_meeting.type))) {
      fail("Conference meetings do not have a local agenda.");
    }
    if (item.slot) fail("Clear the standard entry instead of deleting it.");
    await tx.sunday_meeting_item.delete({ where: { id: itemId } });
    await normalizeMeetingOrder(tx, item.sunday_meeting_id);
    const remaining = await meetingSortableItems(tx, item.sunday_meeting_id);
    assertNoAdjacentConductorText(remaining);
  });
}
