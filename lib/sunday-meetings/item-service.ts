import { assertSacramentCapacity } from "./sacrament-rules.ts";
import { isSacramentRole } from "./sacrament.ts";
import { prisma } from "@/lib/prisma";
import { canAddAgendaItem } from "./add-item-rules.ts";
import {
  isLocalMeetingType,
  isSundayMeetingItemType,
  isSundayMeetingSection,
  isSundayMeetingTaskItemType,
  type SundayItemMetadata,
  type SundayMeetingItemType,
  type SundayMeetingSection,
  type SundayPersonInput,
} from "./types.ts";
import {
  isItemDataEmpty,
  nextPosition,
  renumberItems,
  sortSundayItems,
} from "./order.ts";
import {
  isStandardSlot,
  slotAllowsItemType,
  type SundayStandardSlot,
} from "./templates.ts";
import {
  asMeetingType,
  asSection,
  assertHymnNumber,
  assertNoAdjacentConductorText,
  assertSinglePersonItemType,
  assertTransitionEmpty,
  fail,
  MAX_ITEM_TEXT_LENGTH,
  requireMeeting,
  requireItem,
  requirePersonMember,
  resolvePersonInput,
  serializeMetadata,
  trimmedOrNullCapped,
  type Transaction,
} from "./rules.ts";
import { meetingSortableItems, saveItemOrder } from "./order-service.ts";
import { updateSundayItemInTransaction } from "./item-update-service.ts";
export {
  updateSundayItem,
  deleteSundayItem,
  type UpdateSundayItemInput,
} from "./item-update-service.ts";
export { moveSundayItem, type MoveSundayItemInput } from "./order-service.ts";

export type AddSundayItemInput = {
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  content?: string | null;
  metadata?: SundayItemMetadata | null;
  person?: SundayPersonInput | null;
  afterItemId?: string | null;
};

async function createItem(
  tx: Transaction,
  wardId: string,
  meetingId: string,
  input: AddSundayItemInput,
  existingRoleSection = false,
) {
  if (
    !isSundayMeetingItemType(input.type) ||
    !isSundayMeetingSection(input.section)
  )
    fail("Invalid agenda item.");
  if (isSundayMeetingTaskItemType(input.type))
    fail("Task presentation items must be added from a suggested task.");
  const participant = [
    "leader",
    "presiding",
    "visitor",
    "organist",
    "music_conductor",
  ].includes(input.type);
  if (participant !== (input.section === "participants"))
    fail("Participant roles belong in the participants section.");
  if (
    !participant &&
    !existingRoleSection &&
    !canAddAgendaItem(input.type, input.section)
  )
    fail("This item type cannot be added to the selected section.");
  const meeting = await requireMeeting(tx, wardId, meetingId);
  if (!isLocalMeetingType(asMeetingType(meeting.type)))
    fail("Conference meetings do not have a local agenda.");
  const content = trimmedOrNullCapped(
    input.content,
    MAX_ITEM_TEXT_LENGTH,
    "Item text",
  );
  const metadata = serializeMetadata(input.metadata);
  const person = resolvePersonInput(input.person);
  assertHymnNumber(input.metadata ?? null);
  assertTransitionEmpty(input.type, content, metadata, person);
  if (person.memberId) await requirePersonMember(tx, wardId, person.memberId);
  if (input.type === "leader" || input.type === "presiding")
    await assertSinglePersonItemType(tx, meetingId, input.type);
  await assertSacramentCapacity(tx, meetingId, input.type, person);
  const items = await meetingSortableItems(tx, meetingId);
  const section = sortSundayItems(
    items.filter((item) => item.section === input.section),
  );
  const anchor = input.afterItemId
    ? section.findIndex((item) => item.id === input.afterItemId)
    : -1;
  if (input.afterItemId && anchor < 0)
    fail("The selected position does not belong to this section.");
  const created = await tx.sunday_meeting_item.create({
    data: {
      sunday_meeting_id: meetingId,
      type: input.type,
      section: input.section,
      order_index: nextPosition(items, input.section),
      content,
      metadata,
      person_member_id: person.memberId,
      person_name: person.personName,
    },
  });
  section.splice(input.afterItemId ? anchor + 1 : section.length, 0, {
    id: created.id,
    type: input.type,
    section: input.section,
    slot: null,
    orderIndex: created.order_index,
    createdAt: created.created_at.toISOString(),
  });
  const planned = [
    ...items.filter((item) => item.section !== input.section),
    ...renumberItems(section),
  ];
  assertNoAdjacentConductorText(planned);
  await saveItemOrder(tx, planned);
  return created.id;
}

export async function addSundayItem(
  wardId: string,
  meetingId: string,
  input: AddSundayItemInput,
): Promise<string> {
  return prisma.$transaction((tx) => createItem(tx, wardId, meetingId, input));
}

export type UpsertSundayItemInput = Omit<AddSundayItemInput, "afterItemId"> & {
  slot?: SundayStandardSlot;
};

/** Standard entries use their stable slot key. Only participant roles are created lazily. */
export async function upsertSundayItem(
  wardId: string,
  meetingId: string,
  input: UpsertSundayItemInput,
): Promise<void> {
  if (
    !isSundayMeetingItemType(input.type) ||
    !isSundayMeetingSection(input.section)
  )
    fail("Invalid agenda item.");
  if (
    input.slot !== undefined &&
    (!isStandardSlot(input.slot) || !slotAllowsItemType(input.slot, input.type))
  )
    fail("Invalid standard slot.");
  await prisma.$transaction(async (tx) => {
    await requireMeeting(tx, wardId, meetingId);
    if (!input.slot && !["leader", "presiding"].includes(input.type))
      fail("A standard slot key is required.");
    const existing = await tx.sunday_meeting_item.findFirst({
      where: {
        sunday_meeting_id: meetingId,
        ...(input.slot
          ? { slot: input.slot }
          : { type: input.type, section: "participants" }),
      },
    });
    if (existing) {
      await updateSundayItemInTransaction(tx, wardId, existing.id, {
        type: input.type,
        content: input.content,
        metadata: input.metadata,
        person: input.person,
      });
      return;
    }
    if (input.slot)
      fail("This standard entry is not available for the meeting type.");
    const person = resolvePersonInput(input.person);
    if (
      isItemDataEmpty({
        type: input.type,
        content: input.content ?? null,
        metadata: input.metadata ?? null,
        personMemberId: person.memberId,
        personName: person.personName,
      })
    )
      return;
    await createItem(tx, wardId, meetingId, input);
  });
}

/** Reuse an empty role record before creating another person record. */
export async function addSacramentPerson(
  wardId: string,
  itemId: string,
  person: SundayPersonInput,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const anchor = await requireItem(tx, wardId, itemId);
    if (!isSundayMeetingItemType(anchor.type) || !isSacramentRole(anchor.type))
      fail("Select a sacrament assignment.");
    const resolved = resolvePersonInput(person);
    if (!resolved.memberId && !resolved.personName) fail("Select a person.");
    const peers = await tx.sunday_meeting_item.findMany({
      where: {
        sunday_meeting_id: anchor.sunday_meeting_id,
        type: anchor.type,
        section: anchor.section,
      },
      orderBy: { order_index: "asc" },
    });
    const empty = peers.find(
      (item) => !item.person_member_id && !item.person_name,
    );
    if (empty) {
      await updateSundayItemInTransaction(tx, wardId, empty.id, { person });
    } else {
      await createItem(
        tx,
        wardId,
        anchor.sunday_meeting_id,
        {
          type: anchor.type,
          section: asSection(anchor.section),
          person,
          afterItemId: peers.at(-1)?.id ?? anchor.id,
        },
        true,
      );
    }
  });
}
