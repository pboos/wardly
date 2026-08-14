import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertSunday,
  assertTimeZone,
  defaultMeetingTypeForSunday,
  firstSundayOfMonth,
  isFirstSundayOfMonth,
  nextSunday,
} from "./calendar";
import {
  ITEM_ASSIGNMENT_ROLES,
  MEETING_ASSIGNMENT_ROLES,
  SINGLE_ITEM_ASSIGNMENT_ROLES,
  isCarryForwardEligible,
  isLocalMeetingType,
  isSundayMeetingItemType,
  isSundayMeetingTaskItemType,
  isSundayMeetingSection,
  isSundayMeetingType,
  isSundayMeetingVisitorRole,
  itemAllowsRole,
  type SundayMeetingAssignmentInput,
  type SundayMeetingAssignmentRole,
  type SundayMeetingItemAssignmentRole,
  type SundayMeetingItemType,
  type SundayMeetingSection,
  type SundayMeetingStandardSlot,
  type SundayMeetingTaskItemType,
  type SundayMeetingType,
} from "./types";
import {
  SECTION_ORDER,
  slotAllowsItemType,
  templateForMeeting,
  templateItemForSlot,
} from "./templates";

type Transaction = Prisma.TransactionClient;

const ORDER_STEP = 100;
const TEMP_ORDER_OFFSET = 1_000_000;
const NEW_ITEM_ORDER = 2_000_000;

type RawAgendaItem = {
  id: string;
  type: string;
  section: string;
  standard_slot: string | null;
  order_index: number;
  content: string | null;
  hymn_number: number | null;
  task_id: string | null;
};

function fail(message: string): never {
  throw new Error(message);
}

function asMeetingType(value: string): SundayMeetingType {
  if (!isSundayMeetingType(value)) {
    return fail("Meeting has an invalid type.");
  }
  return value;
}

function asItemType(value: string): SundayMeetingItemType {
  if (!isSundayMeetingItemType(value)) {
    return fail("Agenda item has an invalid type.");
  }
  return value;
}

function asSection(value: string): SundayMeetingSection {
  if (!isSundayMeetingSection(value)) {
    return fail("Agenda item has an invalid section.");
  }
  return value;
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertAgendaValues(
  type: SundayMeetingItemType,
  content: string | null,
  hymnNumber: number | null,
): void {
  if (type === "transition") {
    if (content || hymnNumber !== null) {
      fail("A transition cannot contain text or a hymn.");
    }
    return;
  }

  if (type === "hymn") {
    if (
      hymnNumber !== null &&
      (!Number.isInteger(hymnNumber) || hymnNumber <= 0)
    ) {
      fail("Hymn number must be a positive whole number.");
    }
    if (content) {
      fail("Hymn details are resolved from the hymn number.");
    }
    return;
  }

  if (hymnNumber !== null) {
    fail("Only hymn items can have a hymn number.");
  }

  if (
    ["prayer", "sacrament_blessing", "sacrament_passing"].includes(type) &&
    content
  ) {
    fail("This agenda item does not support free-text content.");
  }
}

function assertItemAllowedForMeeting(
  meetingType: SundayMeetingType,
  itemType: SundayMeetingItemType,
  standardSlot: SundayMeetingStandardSlot | null,
): void {
  if (!isLocalMeetingType(meetingType)) {
    fail("Conference meetings do not have a local agenda.");
  }

  if (meetingType === "childrens_sacrament_presentation") {
    if (itemType === "talk" || itemType === "musical_number") {
      fail(
        "Children's Sacrament Meeting Presentations use a Primary presentation instead of talks or an interlude.",
      );
    }
    if (itemType === "primary_presentation" && standardSlot === null) {
      fail("A Children's Presentation has one fixed Primary presentation item.");
    }
  } else if (itemType === "primary_presentation") {
    fail("Primary presentations are only available for Children's Presentations.");
  }
}

function assertPersonInput(input: SundayMeetingAssignmentInput): {
  memberId: string | null;
  freeTextName: string | null;
} {
  const memberId = trimmedOrNull(input.memberId);
  const freeTextName = trimmedOrNull(input.freeTextName);
  if (Boolean(memberId) === Boolean(freeTextName)) {
    fail("Choose either a ward member or a free-text name.");
  }
  return { memberId, freeTextName };
}

async function requireWard(
  tx: Transaction,
  wardId: string,
): Promise<{ id: string; time_zone: string }> {
  const ward = await tx.ward.findUnique({
    where: { id: wardId },
    select: { id: true, time_zone: true },
  });
  if (!ward) {
    fail("Ward not found.");
  }
  assertTimeZone(ward.time_zone);
  return ward;
}

async function requireMeeting(
  tx: Transaction,
  wardId: string,
  meetingId: string,
) {
  const meeting = await tx.sunday_meeting.findFirst({
    where: { id: meetingId, ward_id: wardId },
  });
  if (!meeting) {
    fail("Sunday meeting not found.");
  }
  return meeting;
}

async function requireItem(
  tx: Transaction,
  wardId: string,
  itemId: string,
) {
  const item = await tx.sunday_meeting_item.findFirst({
    where: { id: itemId, sunday_meeting: { ward_id: wardId } },
    include: { sunday_meeting: true },
  });
  if (!item) {
    fail("Agenda item not found.");
  }
  return item;
}

async function defaultTypeForDate(
  tx: Transaction,
  wardId: string,
  date: string,
): Promise<SundayMeetingType> {
  const firstSunday = firstSundayOfMonth(date);
  const firstMeeting = await tx.sunday_meeting.findUnique({
    where: { ward_id_date: { ward_id: wardId, date: firstSunday } },
    select: { type: true },
  });
  return defaultMeetingTypeForSunday(
    date,
    firstMeeting ? asMeetingType(firstMeeting.type) : null,
  );
}

async function createOrLoadSundayMeetingInTransaction(
  tx: Transaction,
  wardId: string,
  date: string,
  requestedType?: SundayMeetingType,
) {
  await requireWard(tx, wardId);
  assertSunday(date);
  if (requestedType && !isSundayMeetingType(requestedType)) {
    fail("Invalid Sunday meeting type.");
  }

  const type = requestedType ?? (await defaultTypeForDate(tx, wardId, date));
  const template = templateForMeeting(type);

  return tx.sunday_meeting.upsert({
    where: { ward_id_date: { ward_id: wardId, date } },
    update: {},
    create: {
      ward_id: wardId,
      date,
      type,
      sunday_meeting_item: {
        create: template.map((item, index) => ({
          type: item.type,
          section: item.section,
          standard_slot: item.standardSlot,
          order_index: index * ORDER_STEP,
        })),
      },
    },
  });
}

export async function createOrLoadSundayMeeting(
  wardId: string,
  date: string,
  requestedType?: SundayMeetingType,
) {
  return prisma.$transaction((tx) =>
    createOrLoadSundayMeetingInTransaction(tx, wardId, date, requestedType),
  );
}

async function agendaItems(
  tx: Transaction,
  meetingId: string,
): Promise<RawAgendaItem[]> {
  return tx.sunday_meeting_item.findMany({
    where: { sunday_meeting_id: meetingId },
    orderBy: { order_index: "asc" },
  });
}

async function renumberAgenda(
  tx: Transaction,
  meetingId: string,
  orderedIds: readonly string[],
): Promise<void> {
  const existing = await agendaItems(tx, meetingId);
  if (
    existing.length !== orderedIds.length ||
    new Set(orderedIds).size !== existing.length ||
    existing.some((item) => !orderedIds.includes(item.id))
  ) {
    fail("Agenda order must include every item exactly once.");
  }

  // Move every row out of the final range before assigning unique positions.
  await tx.sunday_meeting_item.updateMany({
    where: { sunday_meeting_id: meetingId },
    data: { order_index: { increment: TEMP_ORDER_OFFSET } },
  });

  const updatedAt = new Date();
  for (const [index, id] of orderedIds.entries()) {
    await tx.sunday_meeting_item.update({
      where: { id },
      data: { order_index: index * ORDER_STEP, updated_at: updatedAt },
    });
  }
}

function assertNoAdjacentConductorText(items: readonly RawAgendaItem[]): void {
  for (let index = 1; index < items.length; index += 1) {
    if (
      items[index - 1].type === "conductor_text" &&
      items[index].type === "conductor_text"
    ) {
      fail("Two conductor-text items cannot be adjacent.");
    }
  }
}

function assertItemIsEmpty(
  item: RawAgendaItem,
  assignmentCount: number,
): void {
  if (
    trimmedOrNull(item.content) ||
    item.hymn_number !== null ||
    item.task_id !== null ||
    assignmentCount > 0
  ) {
    fail("This meeting type change would discard planned agenda data.");
  }
}

async function assignmentCountForItem(
  tx: Transaction,
  itemId: string,
): Promise<number> {
  return tx.sunday_meeting_person_assignment.count({
    where: { sunday_meeting_item_id: itemId },
  });
}

function composeTemplateOrder(
  type: SundayMeetingType,
  items: RawAgendaItem[],
): string[] {
  const template = templateForMeeting(type);
  const orderedCustom = items
    .filter((item) => item.standard_slot === null)
    .sort((left, right) => left.order_index - right.order_index);
  const ids: string[] = [];

  for (const section of [
    "opening",
    "business",
    "sacrament",
    "program",
    "closing",
] as const) {
    for (const templateItem of template.filter(
      (item) => item.section === section,
    )) {
      const existing = items.find(
        (item) => item.standard_slot === templateItem.standardSlot,
      );
      if (!existing) {
        fail("The meeting template could not be reconciled.");
      }
      ids.push(existing.id);
    }
    ids.push(
      ...orderedCustom
        .filter((item) => item.section === section)
        .map((item) => item.id),
    );
  }

  return ids;
}

function assertTypeChangeCustomItems(
  targetType: SundayMeetingType,
  items: RawAgendaItem[],
): void {
  const customItems = items.filter((item) => item.standard_slot === null);
  if (!isLocalMeetingType(targetType)) {
    if (customItems.length > 0) {
      fail("A conference meeting cannot retain local agenda items.");
    }
    return;
  }

  if (
    targetType === "childrens_sacrament_presentation" &&
    customItems.some((item) =>
      ["talk", "musical_number", "primary_presentation"].includes(item.type),
    )
  ) {
    fail(
      "A Children's Presentation cannot retain talks, musical interludes, or extra Primary presentation items.",
    );
  }
}

async function applyMeetingType(
  tx: Transaction,
  wardId: string,
  meetingId: string,
  targetType: SundayMeetingType,
): Promise<void> {
  const meeting = await requireMeeting(tx, wardId, meetingId);
  const currentType = asMeetingType(meeting.type);
  if (currentType === targetType) {
    return;
  }

  const currentItems = await agendaItems(tx, meetingId);
  const meetingAssignments = await tx.sunday_meeting_person_assignment.count({
    where: { sunday_meeting_id: meetingId, sunday_meeting_item_id: null },
  });

  if (!isLocalMeetingType(targetType)) {
    if (trimmedOrNull(meeting.information) || meetingAssignments > 0) {
      fail("A conference meeting cannot retain local meeting information or people.");
    }
    for (const item of currentItems) {
      await assertItemIsEmpty(item, await assignmentCountForItem(tx, item.id));
    }
    await tx.sunday_meeting_item.deleteMany({
      where: { sunday_meeting_id: meetingId },
    });
    await tx.sunday_meeting.update({
      where: { id: meetingId },
      data: { type: targetType, updated_at: new Date() },
    });
    return;
  }

  assertTypeChangeCustomItems(targetType, currentItems);
  const targetTemplate = templateForMeeting(targetType);
  const targetSlots = new Set(targetTemplate.map((item) => item.standardSlot));

  for (const item of currentItems) {
    if (!item.standard_slot || targetSlots.has(item.standard_slot as SundayMeetingStandardSlot)) {
      continue;
    }
    await assertItemIsEmpty(item, await assignmentCountForItem(tx, item.id));
    await tx.sunday_meeting_item.delete({ where: { id: item.id } });
  }

  const retainedItems = await agendaItems(tx, meetingId);
  let createdItemOffset = 0;
  for (const templateItem of targetTemplate) {
    const existing = retainedItems.find(
      (item) => item.standard_slot === templateItem.standardSlot,
    );
    if (!existing) {
      await tx.sunday_meeting_item.create({
        data: {
          sunday_meeting_id: meetingId,
          type: templateItem.type,
          section: templateItem.section,
          standard_slot: templateItem.standardSlot,
          order_index: NEW_ITEM_ORDER + createdItemOffset++,
        },
      });
      continue;
    }

    if (
      !slotAllowsItemType(
        templateItem.standardSlot,
        asItemType(existing.type),
      )
    ) {
      fail("This meeting type change would invalidate a fixed agenda item.");
    }

    await tx.sunday_meeting_item.update({
      where: { id: existing.id },
      data: { section: templateItem.section, updated_at: new Date() },
    });
  }

  await tx.sunday_meeting.update({
    where: { id: meetingId },
    data: { type: targetType, updated_at: new Date() },
  });

  const finalItems = await agendaItems(tx, meetingId);
  const finalOrder = composeTemplateOrder(targetType, finalItems);
  assertNoAdjacentConductorText(
    finalOrder.map((id) => {
      const item = finalItems.find((candidate) => candidate.id === id);
      if (!item) {
        fail("The meeting template could not be reconciled.");
      }
      return item;
    }),
  );
  await renumberAgenda(tx, meetingId, finalOrder);
}

async function isPristineMeeting(
  tx: Transaction,
  meetingId: string,
): Promise<boolean> {
  const meeting = await tx.sunday_meeting.findUnique({
    where: { id: meetingId },
    select: { type: true, information: true },
  });
  if (!meeting || trimmedOrNull(meeting.information)) {
    return false;
  }

  const assignments = await tx.sunday_meeting_person_assignment.count({
    where: { sunday_meeting_id: meetingId, sunday_meeting_item_id: null },
  });
  if (assignments > 0) {
    return false;
  }

  const type = asMeetingType(meeting.type);
  const template = templateForMeeting(type);
  const items = await agendaItems(tx, meetingId);
  if (items.length !== template.length) {
    return false;
  }

  for (const templateItem of template) {
    const item = items.find(
      (candidate) => candidate.standard_slot === templateItem.standardSlot,
    );
    if (
      !item ||
      item.type !== templateItem.type ||
      item.section !== templateItem.section ||
      item.content !== null ||
      item.hymn_number !== null ||
      item.task_id !== null ||
      (await assignmentCountForItem(tx, item.id)) > 0
    ) {
      return false;
    }
  }

  return true;
}

async function reconcileSecondSundayDefault(
  tx: Transaction,
  wardId: string,
  firstMeetingId: string,
): Promise<void> {
  const first = await requireMeeting(tx, wardId, firstMeetingId);
  if (!isFirstSundayOfMonth(first.date)) {
    return;
  }

  const secondDate = nextSunday(first.date);
  const second = await tx.sunday_meeting.findUnique({
    where: { ward_id_date: { ward_id: wardId, date: secondDate } },
  });
  if (!second || !(await isPristineMeeting(tx, second.id))) {
    return;
  }

  const desired = defaultMeetingTypeForSunday(
    secondDate,
    asMeetingType(first.type),
  );
  if (asMeetingType(second.type) !== desired) {
    await applyMeetingType(tx, wardId, second.id, desired);
  }
}

export async function changeMeetingType(
  wardId: string,
  meetingId: string,
  targetType: SundayMeetingType,
): Promise<void> {
  if (!isSundayMeetingType(targetType)) {
    fail("Invalid Sunday meeting type.");
  }

  await prisma.$transaction(async (tx) => {
    await applyMeetingType(tx, wardId, meetingId, targetType);
    await reconcileSecondSundayDefault(tx, wardId, meetingId);
  });
}

export async function updateMeetingInformation(
  wardId: string,
  meetingId: string,
  information: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const meeting = await requireMeeting(tx, wardId, meetingId);
    if (!isLocalMeetingType(asMeetingType(meeting.type))) {
      fail("Conference meetings do not have local meeting information.");
    }
    await tx.sunday_meeting.update({
      where: { id: meeting.id },
      data: { information: trimmedOrNull(information), updated_at: new Date() },
    });
  });
}

export async function updateSundayMeetingSettings(
  wardId: string,
  input: { contentLocale: string; timeZone: string },
): Promise<void> {
  const contentLocale = input.contentLocale.trim();
  if (!contentLocale) {
    fail("Content locale is required.");
  }
  try {
    Intl.getCanonicalLocales(contentLocale);
  } catch {
    fail("Content locale must be a valid BCP 47 locale.");
  }
  assertTimeZone(input.timeZone.trim());

  await prisma.ward.update({
    where: { id: wardId },
    data: {
      content_locale: contentLocale,
      time_zone: input.timeZone.trim(),
      updated_at: new Date(),
    },
  });
}

function sectionInsertionIndex(
  items: RawAgendaItem[],
  section: SundayMeetingSection,
): number {
  const lastInSection = items.reduce<number>(
    (lastIndex, item, index) =>
      item.section === section ? index : lastIndex,
    -1,
  );
  if (lastInSection >= 0) {
    return lastInSection + 1;
  }

  const nextSection = items.findIndex(
    (item) => SECTION_ORDER[asSection(item.section)] > SECTION_ORDER[section],
  );
  return nextSection >= 0 ? nextSection : items.length;
}

export type AddAgendaItemInput = {
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  content?: string | null;
  hymnNumber?: number | null;
  afterItemId?: string | null;
};

export async function addAgendaItem(
  wardId: string,
  meetingId: string,
  input: AddAgendaItemInput,
): Promise<string> {
  if (!isSundayMeetingItemType(input.type) || !isSundayMeetingSection(input.section)) {
    fail("Invalid agenda item.");
  }
  if (isSundayMeetingTaskItemType(input.type)) {
    fail("Task presentation items must be added from a suggested task.");
  }

  const content = trimmedOrNull(input.content);
  const hymnNumber = input.hymnNumber ?? null;
  assertAgendaValues(input.type, content, hymnNumber);

  return prisma.$transaction(async (tx) => {
    const meeting = await requireMeeting(tx, wardId, meetingId);
    const meetingType = asMeetingType(meeting.type);
    assertItemAllowedForMeeting(meetingType, input.type, null);

    const items = await agendaItems(tx, meetingId);
    let insertionIndex = sectionInsertionIndex(items, input.section);
    if (input.afterItemId) {
      const afterIndex = items.findIndex((item) => item.id === input.afterItemId);
      if (afterIndex < 0) {
        fail("The selected agenda position does not belong to this meeting.");
      }
      insertionIndex = afterIndex + 1;
    }

    const proposed: RawAgendaItem[] = [
      ...items.slice(0, insertionIndex),
      {
        id: "new",
        type: input.type,
        section: input.section,
        standard_slot: null,
        order_index: NEW_ITEM_ORDER,
        content,
        hymn_number: hymnNumber,
        task_id: null,
      },
      ...items.slice(insertionIndex),
    ];
    assertNoAdjacentConductorText(proposed);

    const created = await tx.sunday_meeting_item.create({
      data: {
        sunday_meeting_id: meetingId,
        type: input.type,
        section: input.section,
        order_index: NEW_ITEM_ORDER,
        content,
        hymn_number: hymnNumber,
      },
    });
    proposed[insertionIndex] = { ...proposed[insertionIndex], id: created.id };
    await renumberAgenda(
      tx,
      meetingId,
      proposed.map((item) => item.id),
    );
    return created.id;
  });
}

export type UpdateAgendaItemInput = {
  type?: SundayMeetingItemType;
  section?: SundayMeetingSection;
  content?: string | null;
  hymnNumber?: number | null;
};

export async function updateAgendaItem(
  wardId: string,
  itemId: string,
  input: UpdateAgendaItemInput,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    const meetingType = asMeetingType(item.sunday_meeting.type);
    const currentType = asItemType(item.type);
    const currentSection = asSection(item.section);
    const targetType = input.type ?? currentType;
    const targetSection = input.section ?? currentSection;
    const targetContent =
      input.content === undefined ? item.content : trimmedOrNull(input.content);
    const targetHymnNumber =
      input.hymnNumber === undefined ? item.hymn_number : input.hymnNumber;
    const slot = item.standard_slot as SundayMeetingStandardSlot | null;

    if (!isSundayMeetingItemType(targetType) || !isSundayMeetingSection(targetSection)) {
      fail("Invalid agenda item.");
    }
    assertItemAllowedForMeeting(meetingType, targetType, slot);
    assertAgendaValues(targetType, targetContent, targetHymnNumber);

    if (slot) {
      const templateItem = templateItemForSlot(meetingType, slot);
      if (!templateItem) {
        fail("This fixed item is not valid for the meeting type.");
      }
      if (targetSection !== templateItem.section) {
        fail("A fixed agenda item cannot move to another section.");
      }
      if (!slotAllowsItemType(slot, targetType)) {
        fail("This fixed slot does not support that agenda item type.");
      }
    }

    const assignmentCount = await assignmentCountForItem(tx, itemId);
    if (targetType === "transition" && assignmentCount > 0) {
      fail("A transition cannot have person assignments.");
    }
    if (targetType !== currentType && assignmentCount > 0) {
      const assignments = await tx.sunday_meeting_person_assignment.findMany({
        where: { sunday_meeting_item_id: itemId },
        select: { role: true },
      });
      if (
        assignments.some(
          (assignment) =>
            !itemAllowsRole(
              targetType,
              assignment.role as SundayMeetingItemAssignmentRole,
            ),
        )
      ) {
        fail("This item type cannot keep its current person assignments.");
      }
    }
    if (item.task_id && targetType !== currentType) {
      fail("A task-linked item must keep its task presentation type.");
    }
    if (isSundayMeetingTaskItemType(targetType) && !item.task_id) {
      fail("Task presentation items must be added from a suggested task.");
    }

    const items = await agendaItems(tx, item.sunday_meeting_id);
    const proposed = items.map((candidate) =>
      candidate.id === itemId
        ? {
            ...candidate,
            type: targetType,
            section: targetSection,
            content: targetContent,
            hymn_number: targetHymnNumber,
          }
        : candidate,
    );
    assertNoAdjacentConductorText(proposed);

    await tx.sunday_meeting_item.update({
      where: { id: itemId },
      data: {
        type: targetType,
        section: targetSection,
        content: targetContent,
        hymn_number: targetHymnNumber,
        updated_at: new Date(),
      },
    });
  });
}

export async function deleteAgendaItem(
  wardId: string,
  itemId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    if (item.standard_slot) {
      fail("Fixed template items cannot be deleted.");
    }

    await tx.sunday_meeting_item.delete({ where: { id: itemId } });
    const remaining = await agendaItems(tx, item.sunday_meeting_id);
    assertNoAdjacentConductorText(remaining);
    await renumberAgenda(
      tx,
      item.sunday_meeting_id,
      remaining.map((candidate) => candidate.id),
    );
  });
}

export async function reorderAgenda(
  wardId: string,
  meetingId: string,
  orderedItemIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const meeting = await requireMeeting(tx, wardId, meetingId);
    if (!isLocalMeetingType(asMeetingType(meeting.type))) {
      fail("Conference meetings do not have a local agenda.");
    }
    const items = await agendaItems(tx, meetingId);
    if (items.some((item) => item.standard_slot !== null)) {
      const originalFixedOrder = items
        .filter((item) => item.standard_slot !== null)
        .map((item) => item.id);
      const proposedFixedOrder = orderedItemIds.filter((id) =>
        items.some((item) => item.id === id && item.standard_slot !== null),
      );
      if (
        originalFixedOrder.length !== proposedFixedOrder.length ||
        originalFixedOrder.some((id, index) => id !== proposedFixedOrder[index])
      ) {
        fail("Fixed agenda slots must remain in their template order.");
      }
    }
    const ordered = orderedItemIds.map((id) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) {
        fail("Agenda order contains an item from another meeting.");
      }
      return item;
    });
    assertNoAdjacentConductorText(ordered);
    await renumberAgenda(tx, meetingId, orderedItemIds);
  });
}

async function validatePerson(
  tx: Transaction,
  wardId: string,
  input: SundayMeetingAssignmentInput,
): Promise<{ member_id: string | null; free_text_name: string | null }> {
  const person = assertPersonInput(input);
  if (person.memberId) {
    const member = await tx.member.findFirst({
      where: { id: person.memberId, ward_id: wardId },
      select: { id: true },
    });
    if (!member) {
      fail("Selected member does not belong to this ward.");
    }
  }
  return {
    member_id: person.memberId,
    free_text_name: person.freeTextName,
  };
}

function validateVisitorFields(
  role: SundayMeetingAssignmentRole,
  input: SundayMeetingAssignmentInput,
): {
  visitor_role: string | null;
  visitor_role_custom: string | null;
  is_presiding_override: boolean;
} {
  if (role !== "visitor") {
    if (
      input.visitorRole !== undefined ||
      input.visitorRoleCustom !== undefined ||
      input.isPresidingOverride
    ) {
      fail("Visitor details are only valid for visitors.");
    }
    return {
      visitor_role: null,
      visitor_role_custom: null,
      is_presiding_override: false,
    };
  }

  const visitorRole = input.visitorRole ?? null;
  if (visitorRole !== null && !isSundayMeetingVisitorRole(visitorRole)) {
    fail("Invalid visitor role.");
  }
  const customRole = trimmedOrNull(input.visitorRoleCustom);
  if (visitorRole === "custom" && !customRole) {
    fail("Custom visitors require a role label.");
  }
  if (visitorRole !== "custom" && customRole) {
    fail("Only custom visitors can have a custom role label.");
  }
  return {
    visitor_role: visitorRole,
    visitor_role_custom: customRole,
    is_presiding_override: input.isPresidingOverride ?? false,
  };
}

async function nextAssignmentOrder(
  tx: Transaction,
  meetingId: string,
  itemId: string | null,
  role: string,
): Promise<number> {
  const latest = await tx.sunday_meeting_person_assignment.findFirst({
    where: {
      sunday_meeting_id: meetingId,
      sunday_meeting_item_id: itemId,
      role,
    },
    orderBy: { order_index: "desc" },
    select: { order_index: true },
  });
  return (latest?.order_index ?? -1) + 1;
}

async function addMeetingAssignmentInTransaction(
  tx: Transaction,
  wardId: string,
  meetingId: string,
  role: SundayMeetingAssignmentRole,
  input: SundayMeetingAssignmentInput,
) {
  const meeting = await requireMeeting(tx, wardId, meetingId);
  if (!isLocalMeetingType(asMeetingType(meeting.type))) {
    fail("Conference meetings do not have local people assignments.");
  }
  if (!(MEETING_ASSIGNMENT_ROLES as readonly string[]).includes(role)) {
    fail("Invalid meeting assignment role.");
  }

  if (role === "leader") {
    const existingLeader = await tx.sunday_meeting_person_assignment.findFirst({
      where: {
        sunday_meeting_id: meetingId,
        sunday_meeting_item_id: null,
        role: "leader",
      },
      select: { id: true },
    });
    if (existingLeader) {
      fail("This meeting already has a leader.");
    }
  }

  const person = await validatePerson(tx, wardId, input);
  const visitor = validateVisitorFields(role, input);
  if (visitor.is_presiding_override) {
    await tx.sunday_meeting_person_assignment.updateMany({
      where: {
        sunday_meeting_id: meetingId,
        sunday_meeting_item_id: null,
        role: "visitor",
        is_presiding_override: true,
      },
      data: { is_presiding_override: false, updated_at: new Date() },
    });
  }

  return tx.sunday_meeting_person_assignment.create({
    data: {
      sunday_meeting_id: meetingId,
      sunday_meeting_item_id: null,
      role,
      ...person,
      order_index: await nextAssignmentOrder(tx, meetingId, null, role),
      ...visitor,
    },
  });
}

export async function addMeetingAssignment(
  wardId: string,
  meetingId: string,
  role: SundayMeetingAssignmentRole,
  input: SundayMeetingAssignmentInput,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const assignment = await addMeetingAssignmentInTransaction(
      tx,
      wardId,
      meetingId,
      role,
      input,
    );
    return assignment.id;
  });
}

export async function setMeetingLeader(
  wardId: string,
  meetingId: string,
  input: SundayMeetingAssignmentInput | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireMeeting(tx, wardId, meetingId);
    await tx.sunday_meeting_person_assignment.deleteMany({
      where: {
        sunday_meeting_id: meetingId,
        sunday_meeting_item_id: null,
        role: "leader",
      },
    });
    if (input) {
      await addMeetingAssignmentInTransaction(tx, wardId, meetingId, "leader", input);
    }
  });
}

export async function addItemAssignment(
  wardId: string,
  itemId: string,
  role: SundayMeetingItemAssignmentRole,
  input: SundayMeetingAssignmentInput,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    if (!isLocalMeetingType(asMeetingType(item.sunday_meeting.type))) {
      fail("Conference meetings do not have local people assignments.");
    }
    const type = asItemType(item.type);
    if (!(ITEM_ASSIGNMENT_ROLES as readonly string[]).includes(role)) {
      fail("Invalid agenda item assignment role.");
    }
    if (!itemAllowsRole(type, role)) {
      fail("This person role is not valid for the agenda item type.");
    }
    if ((SINGLE_ITEM_ASSIGNMENT_ROLES as readonly string[]).includes(role)) {
      const existing = await tx.sunday_meeting_person_assignment.count({
        where: { sunday_meeting_item_id: itemId, role },
      });
      if (existing > 0) {
        fail("This agenda item already has a person in that role.");
      }
    }

    const person = await validatePerson(tx, wardId, input);
    if (
      input.visitorRole !== undefined ||
      input.visitorRoleCustom !== undefined ||
      input.isPresidingOverride
    ) {
      fail("Agenda item assignments cannot use visitor details.");
    }
    const assignment = await tx.sunday_meeting_person_assignment.create({
      data: {
        sunday_meeting_id: item.sunday_meeting_id,
        sunday_meeting_item_id: itemId,
        role,
        ...person,
        order_index: await nextAssignmentOrder(
          tx,
          item.sunday_meeting_id,
          itemId,
          role,
        ),
      },
    });
    return assignment.id;
  });
}

export async function replaceItemAssignment(
  wardId: string,
  itemId: string,
  role: SundayMeetingItemAssignmentRole,
  input: SundayMeetingAssignmentInput | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    if (!isLocalMeetingType(asMeetingType(item.sunday_meeting.type))) {
      fail("Conference meetings do not have local people assignments.");
    }
    if (!itemAllowsRole(asItemType(item.type), role)) {
      fail("This person role is not valid for the agenda item type.");
    }
    await tx.sunday_meeting_person_assignment.deleteMany({
      where: { sunday_meeting_item_id: itemId, role },
    });
    if (input) {
      await addItemAssignmentInTransaction(tx, wardId, item, role, input);
    }
  });
}

async function addItemAssignmentInTransaction(
  tx: Transaction,
  wardId: string,
  item: Awaited<ReturnType<typeof requireItem>>,
  role: SundayMeetingItemAssignmentRole,
  input: SundayMeetingAssignmentInput,
): Promise<void> {
  const person = await validatePerson(tx, wardId, input);
  if (
    input.visitorRole !== undefined ||
    input.visitorRoleCustom !== undefined ||
    input.isPresidingOverride
  ) {
    fail("Agenda item assignments cannot use visitor details.");
  }
  await tx.sunday_meeting_person_assignment.create({
    data: {
      sunday_meeting_id: item.sunday_meeting_id,
      sunday_meeting_item_id: item.id,
      role,
      ...person,
      order_index: await nextAssignmentOrder(
        tx,
        item.sunday_meeting_id,
        item.id,
        role,
      ),
    },
  });
}

export async function updateAssignment(
  wardId: string,
  assignmentId: string,
  input: SundayMeetingAssignmentInput,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const assignment = await tx.sunday_meeting_person_assignment.findFirst({
      where: { id: assignmentId, sunday_meeting: { ward_id: wardId } },
    });
    if (!assignment) {
      fail("Person assignment not found.");
    }

    const person = await validatePerson(tx, wardId, input);
    if (assignment.sunday_meeting_item_id !== null) {
      if (
        input.visitorRole !== undefined ||
        input.visitorRoleCustom !== undefined ||
        input.isPresidingOverride
      ) {
        fail("Agenda item assignments cannot use visitor details.");
      }
      await tx.sunday_meeting_person_assignment.update({
        where: { id: assignmentId },
        data: { ...person, updated_at: new Date() },
      });
      return;
    }

    const role = assignment.role as SundayMeetingAssignmentRole;
    const visitor = validateVisitorFields(role, input);
    if (visitor.is_presiding_override) {
      await tx.sunday_meeting_person_assignment.updateMany({
        where: {
          sunday_meeting_id: assignment.sunday_meeting_id,
          sunday_meeting_item_id: null,
          role: "visitor",
          is_presiding_override: true,
          id: { not: assignmentId },
        },
        data: { is_presiding_override: false, updated_at: new Date() },
      });
    }
    await tx.sunday_meeting_person_assignment.update({
      where: { id: assignmentId },
      data: { ...person, ...visitor, updated_at: new Date() },
    });
  });
}

export async function removeAssignment(
  wardId: string,
  assignmentId: string,
): Promise<void> {
  const deleted = await prisma.sunday_meeting_person_assignment.deleteMany({
    where: { id: assignmentId, sunday_meeting: { ward_id: wardId } },
  });
  if (deleted.count === 0) {
    fail("Person assignment not found.");
  }
}

export async function setPresidingVisitor(
  wardId: string,
  meetingId: string,
  assignmentId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireMeeting(tx, wardId, meetingId);
    if (assignmentId) {
      const visitor = await tx.sunday_meeting_person_assignment.findFirst({
        where: {
          id: assignmentId,
          sunday_meeting_id: meetingId,
          sunday_meeting_item_id: null,
          role: "visitor",
        },
        select: { id: true },
      });
      if (!visitor) {
        fail("Presiding person must be a visitor for this meeting.");
      }
    }
    await tx.sunday_meeting_person_assignment.updateMany({
      where: {
        sunday_meeting_id: meetingId,
        sunday_meeting_item_id: null,
        role: "visitor",
        is_presiding_override: true,
      },
      data: { is_presiding_override: false, updated_at: new Date() },
    });
    if (assignmentId) {
      await tx.sunday_meeting_person_assignment.update({
        where: { id: assignmentId },
        data: { is_presiding_override: true, updated_at: new Date() },
      });
    }
  });
}

async function createTaskItemInTransaction(
  tx: Transaction,
  wardId: string,
  meetingId: string,
  taskId: string,
  itemType: SundayMeetingTaskItemType,
): Promise<string> {
  const meeting = await requireMeeting(tx, wardId, meetingId);
  const meetingType = asMeetingType(meeting.type);
  if (!isLocalMeetingType(meetingType)) {
    fail("Conference meetings do not have a local agenda.");
  }
  if (!isSundayMeetingTaskItemType(itemType)) {
    fail("Task state has an invalid Sunday meeting item type.");
  }
  const task = await tx.task.findFirst({
    where: { id: taskId, ward_id: wardId },
    select: { id: true },
  });
  if (!task) {
    fail("Task not found in this ward.");
  }
  const duplicate = await tx.sunday_meeting_item.findFirst({
    where: { sunday_meeting_id: meetingId, task_id: taskId },
    select: { id: true },
  });
  if (duplicate) {
    fail("This task is already on the meeting agenda.");
  }

  const items = await agendaItems(tx, meetingId);
  const insertionIndex = sectionInsertionIndex(items, "business");
  const created = await tx.sunday_meeting_item.create({
    data: {
      sunday_meeting_id: meetingId,
      type: itemType,
      section: "business",
      order_index: NEW_ITEM_ORDER,
      task_id: taskId,
    },
  });
  const orderedIds = [...items.map((item) => item.id)];
  orderedIds.splice(insertionIndex, 0, created.id);
  await renumberAgenda(tx, meetingId, orderedIds);
  return created.id;
}

export async function addTaskItem(
  wardId: string,
  meetingId: string,
  taskId: string,
  itemType: SundayMeetingTaskItemType,
): Promise<string> {
  return prisma.$transaction((tx) =>
    createTaskItemInTransaction(tx, wardId, meetingId, taskId, itemType),
  );
}

export async function carryForwardItem(
  wardId: string,
  itemId: string,
): Promise<{ destinationDate: string }> {
  return prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    const itemType = asItemType(item.type);
    if (!isCarryForwardEligible(itemType) || item.standard_slot !== null) {
      fail("This agenda item cannot be carried forward.");
    }

    let destinationDate = nextSunday(item.sunday_meeting.date);
    let destination: Awaited<
      ReturnType<typeof createOrLoadSundayMeetingInTransaction>
    > | null = null;
    for (let attempts = 0; attempts < 104; attempts += 1) {
      destination = await createOrLoadSundayMeetingInTransaction(
        tx,
        wardId,
        destinationDate,
      );
      if (isLocalMeetingType(asMeetingType(destination.type))) {
        break;
      }
      destinationDate = nextSunday(destinationDate);
    }
    if (!destination || !isLocalMeetingType(asMeetingType(destination.type))) {
      fail("Could not find a later local Sunday meeting.");
    }

    const sourceItems = await agendaItems(tx, item.sunday_meeting_id);
    const destinationItems = await agendaItems(tx, destination.id);
    const insertionIndex = sectionInsertionIndex(
      destinationItems,
      asSection(item.section),
    );

    await tx.sunday_meeting_item.update({
      where: { id: item.id },
      data: {
        sunday_meeting_id: destination.id,
        order_index: NEW_ITEM_ORDER,
        updated_at: new Date(),
      },
    });
    await tx.sunday_meeting_person_assignment.updateMany({
      where: { sunday_meeting_item_id: item.id },
      data: { sunday_meeting_id: destination.id, updated_at: new Date() },
    });

    const sourceOrder = sourceItems
      .filter((candidate) => candidate.id !== item.id)
      .map((candidate) => candidate.id);
    const sourceAfterMove = await agendaItems(tx, item.sunday_meeting_id);
    assertNoAdjacentConductorText(
      sourceOrder.map((id) => {
        const sourceItem = sourceAfterMove.find((candidate) => candidate.id === id);
        if (!sourceItem) {
          fail("Could not preserve the source agenda order.");
        }
        return sourceItem;
      }),
    );
    await renumberAgenda(tx, item.sunday_meeting_id, sourceOrder);
    const destinationOrder = destinationItems.map((candidate) => candidate.id);
    destinationOrder.splice(insertionIndex, 0, item.id);
    const destinationAfterMove = await agendaItems(tx, destination.id);
    assertNoAdjacentConductorText(
      destinationOrder.map((id) => {
        const destinationItem = destinationAfterMove.find(
          (candidate) => candidate.id === id,
        );
        if (!destinationItem) {
          fail("Could not preserve the destination agenda order.");
        }
        return destinationItem;
      }),
    );
    await renumberAgenda(tx, destination.id, destinationOrder);

    return { destinationDate };
  });
}
