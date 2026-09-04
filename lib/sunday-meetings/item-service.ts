import { prisma } from "@/lib/prisma";
import {
  isLocalMeetingType,
  isSundayMeetingItemType,
  isSundayMeetingSection,
  isSundayMeetingTaskItemType,
  parseItemMetadata,
  type SundayItemMetadata,
  type SundayMeetingItemType,
  type SundayMeetingSection,
  type SundayMeetingType,
  type SundayPersonInput,
} from "./types.ts";
import {
  computeMovePlan,
  isAutoDeletableItem,
  isItemDataEmpty,
  RANK_STEP,
  sectionEndKey,
  sortSundayItems,
  type MovePlan,
} from "./order.ts";
import {
  defaultRank,
  virtualAgendaForMeeting,
} from "./templates.ts";
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
  meetingItems,
  requireItem,
  requireMeeting,
  requirePersonMember,
  resolvePersonInput,
  serializeMetadata,
  sortableList,
  trimmedOrNullCapped,
  type ResolvedPerson,
  type SortableItem,
  type Transaction,
} from "./rules.ts";

async function meetingSortableItems(tx: Transaction, meetingId: string) {
  return sortableList(await meetingItems(tx, meetingId));
}

type PlannedMove = {
  id: string;
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  createdAt?: string;
};

/**
 * The item list as it will look after a move plan is applied — used to
 * validate rules (adjacent conductor text) on the resulting order.
 */
function applyPlanToList(
  items: readonly SortableItem[],
  plan: MovePlan,
  moved: PlannedMove,
): SortableItem[] {
  const rekeyById = new Map(
    plan.rekeys.map((rekey) => [rekey.id, rekey.orderIndex]),
  );
  const list: SortableItem[] = [];
  for (const item of items) {
    if (item.id === moved.id) {
      continue;
    }
    const rekey = rekeyById.get(item.id);
    list.push(rekey === undefined ? item : { ...item, orderIndex: rekey });
  }
  list.push({
    id: moved.id,
    type: moved.type,
    section: moved.section,
    orderIndex: plan.orderIndex,
    createdAt: moved.createdAt ?? new Date().toISOString(),
  });
  return list;
}

export type AddSundayItemInput = {
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  content?: string | null;
  metadata?: SundayItemMetadata | null;
  person?: SundayPersonInput | null;
  afterItemId?: string | null;
};

export async function addSundayItem(
  wardId: string,
  meetingId: string,
  input: AddSundayItemInput,
): Promise<string> {
  if (
    !isSundayMeetingItemType(input.type) ||
    !isSundayMeetingSection(input.section)
  ) {
    fail("Invalid agenda item.");
  }
  if (isSundayMeetingTaskItemType(input.type)) {
    fail("Task presentation items must be added from a suggested task.");
  }

  const content = trimmedOrNullCapped(
    input.content,
    MAX_ITEM_TEXT_LENGTH,
    "Item text",
  );
  const metadata = serializeMetadata(input.metadata);
  const person = resolvePersonInput(input.person);
  assertHymnNumber(input.metadata ?? null);
  assertTransitionEmpty(input.type, content, metadata, person);

  return prisma.$transaction(async (tx) => {
    const meeting = await requireMeeting(tx, wardId, meetingId);
    if (!isLocalMeetingType(asMeetingType(meeting.type))) {
      fail("Conference meetings do not have a local agenda.");
    }
    if (person.memberId) {
      await requirePersonMember(tx, wardId, person.memberId);
    }
    if (input.type === "leader" || input.type === "presiding") {
      await assertSinglePersonItemType(tx, meetingId, input.type);
    }

    const items = await meetingSortableItems(tx, meetingId);
    let orderIndex: number | null = null;
    let rekeys: MovePlan["rekeys"] = [];
    let plannedItems: SortableItem[];
    if (input.afterItemId) {
      if (!items.some((item) => item.id === input.afterItemId)) {
        fail("The selected agenda position does not belong to this meeting.");
      }
      const plan = computeMovePlan(
        items,
        null,
        input.afterItemId,
        input.section,
      );
      if (!plan) {
        fail("The selected agenda position does not belong to that section.");
      }
      orderIndex = plan.orderIndex;
      rekeys = plan.rekeys;
      plannedItems = applyPlanToList(items, plan, {
        id: "__new__",
        type: input.type,
        section: input.section,
      });
    } else {
      plannedItems = [
        ...items,
        {
          id: "__new__",
          type: input.type,
          section: input.section,
          orderIndex: null,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    assertNoAdjacentConductorText(plannedItems);

    const now = new Date();
    const created = await tx.sunday_meeting_item.create({
      data: {
        sunday_meeting_id: meetingId,
        type: input.type,
        section: input.section,
        order_index: orderIndex,
        content,
        metadata,
        person_member_id: person.memberId,
        person_name: person.personName,
      },
    });
    // Tied neighbours may have been re-keyed to make room for the new item.
    for (const rekey of rekeys) {
      await tx.sunday_meeting_item.update({
        where: { id: rekey.id },
        data: { order_index: rekey.orderIndex, updated_at: now },
      });
    }
    return created.id;
  });
}

export type UpdateSundayItemInput = {
  content?: string | null;
  metadata?: SundayItemMetadata | null;
  person?: SundayPersonInput | null;
  section?: SundayMeetingSection;
  type?: SundayMeetingItemType;
};

async function updateSundayItemInTransaction(
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
  const targetSection = input.section ?? currentSection;
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
      : input.metadata ?? null;
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

  // Auto-delete rule: an emptied row disappears; the slot renders empty
  // again. Transitions and task-linked rows are exempt — see
  // isAutoDeletableItem.
  if (
    isAutoDeletableItem({
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
    await tx.sunday_meeting_item.delete({ where: { id: itemId } });
    const remaining = await meetingSortableItems(
      tx,
      item.sunday_meeting_id,
    );
    assertNoAdjacentConductorText(remaining);
  });
}

export type MoveSundayItemInput = {
  afterItemId?: string | null;
  section?: SundayMeetingSection;
  /**
   * Where a null anchor places the item within the section. "end" lands it
   * after the highest effective key present, including the default keys of
   * the section's virtual (empty-editor) slots. Default "start".
   */
  position?: "start" | "end";
};

/** Default sort keys of a meeting type's virtual slots within a section. */
function virtualPhantomKeys(
  meetingType: SundayMeetingType,
  section: SundayMeetingSection,
): number[] {
  return virtualAgendaForMeeting(meetingType)
    .filter((entry) => entry.section === section)
    .map((entry) => defaultRank(entry.section, entry.type) * RANK_STEP);
}

export async function moveSundayItem(
  wardId: string,
  itemId: string,
  input: MoveSundayItemInput,
): Promise<void> {
  if (input.section !== undefined && !isSundayMeetingSection(input.section)) {
    fail("Invalid agenda section.");
  }

  await prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    if (!isLocalMeetingType(asMeetingType(item.sunday_meeting.type))) {
      fail("Conference meetings do not have a local agenda.");
    }

    const items = await meetingSortableItems(tx, item.sunday_meeting_id);
    const moved = items.find((candidate) => candidate.id === itemId);
    if (!moved) {
      fail("Agenda item not found.");
    }

    let targetSection = input.section ?? moved.section;
    const afterItemId = input.afterItemId ?? null;
    if (afterItemId !== null) {
      const anchor = items.find((candidate) => candidate.id === afterItemId);
      if (!anchor || anchor.id === itemId) {
        fail("The selected agenda position does not belong to this meeting.");
      }
      if (input.section === undefined) {
        targetSection = anchor.section;
      } else if (anchor.section !== targetSection) {
        fail("The selected agenda position does not belong to that section.");
      }
    }

    const plan =
      afterItemId !== null
        ? computeMovePlan(items, itemId, afterItemId, targetSection)
        : input.position === "end"
          ? {
              orderIndex: sectionEndKey(
                items,
                targetSection,
                virtualPhantomKeys(
                  asMeetingType(item.sunday_meeting.type),
                  targetSection,
                ),
              ),
              rekeys: [],
            }
          : computeMovePlan(items, itemId, null, targetSection);
    if (!plan) {
      fail("The selected agenda position cannot be used.");
    }

    assertNoAdjacentConductorText(
      applyPlanToList(items, plan, {
        id: itemId,
        type: moved.type,
        section: targetSection,
        createdAt: moved.createdAt,
      }),
    );

    const now = new Date();
    await tx.sunday_meeting_item.update({
      where: { id: itemId },
      data: {
        section: targetSection,
        order_index: plan.orderIndex,
        updated_at: now,
      },
    });
    // Tied neighbours may have been re-keyed to make room for the moved item.
    for (const rekey of plan.rekeys) {
      await tx.sunday_meeting_item.update({
        where: { id: rekey.id },
        data: { order_index: rekey.orderIndex, updated_at: now },
      });
    }
  });
}

export type UpsertSundayItemInput = {
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  content?: string | null;
  metadata?: SundayItemMetadata | null;
  person?: SundayPersonInput | null;
};

export async function upsertSundayItem(
  wardId: string,
  meetingId: string,
  input: UpsertSundayItemInput,
): Promise<void> {
  if (
    !isSundayMeetingItemType(input.type) ||
    !isSundayMeetingSection(input.section)
  ) {
    fail("Invalid agenda item.");
  }
  if (isSundayMeetingTaskItemType(input.type)) {
    fail("Task presentation items must be added from a suggested task.");
  }

  await prisma.$transaction(async (tx) => {
    const meeting = await requireMeeting(tx, wardId, meetingId);
    if (!isLocalMeetingType(asMeetingType(meeting.type))) {
      fail("Conference meetings do not have a local agenda.");
    }

    const items: SortableItem[] = await meetingSortableItems(tx, meetingId);
    // Slot cells edit the FIRST item of that type in that section (final order).
    const existing = sortSundayItems(items).find(
      (item) => item.type === input.type && item.section === input.section,
    );

    if (existing) {
      await updateSundayItemInTransaction(tx, wardId, existing.id, {
        content: input.content,
        metadata: input.metadata,
        person: input.person,
      });
      return;
    }

    const content = trimmedOrNullCapped(
      input.content,
      MAX_ITEM_TEXT_LENGTH,
      "Item text",
    );
    const metadata = serializeMetadata(input.metadata);
    const person = resolvePersonInput(input.person);
    assertHymnNumber(input.metadata ?? null);
    assertTransitionEmpty(input.type, content, metadata, person);
    // Creation rule: a row persists only once real data exists. Upserting an
    // empty value onto a missing slot simply leaves the virtual slot empty.
    if (
      isItemDataEmpty({
        type: input.type,
        content,
        metadata: input.metadata ?? null,
        personMemberId: person.memberId,
        personName: person.personName,
      })
    ) {
      return;
    }
    if (person.memberId) {
      await requirePersonMember(tx, wardId, person.memberId);
    }
    if (input.type === "leader" || input.type === "presiding") {
      await assertSinglePersonItemType(tx, meetingId, input.type);
    }
    assertNoAdjacentConductorText([
      ...items,
      {
        id: "__new__",
        type: input.type,
        section: input.section,
        orderIndex: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    await tx.sunday_meeting_item.create({
      data: {
        sunday_meeting_id: meetingId,
        type: input.type,
        section: input.section,
        order_index: null,
        content,
        metadata,
        person_member_id: person.memberId,
        person_name: person.personName,
      },
    });
  });
}
