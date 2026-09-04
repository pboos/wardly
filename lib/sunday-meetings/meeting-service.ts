import { prisma } from "@/lib/prisma";
import {
  assertSunday,
  assertTimeZone,
  defaultMeetingTypeForSunday,
  firstSundayOfMonth,
  localToday,
  nextSunday,
  previousSunday,
  upcomingSunday,
} from "./calendar.ts";
import {
  isCarryForwardEligible,
  isLocalMeetingType,
  isSundayMeetingTaskItemType,
  isSundayMeetingType,
  type SundayMeetingTaskItemType,
  type SundayMeetingType,
} from "./types.ts";
import {
  asItemType,
  asMeetingType,
  fail,
  MAX_ITEM_TEXT_LENGTH,
  requireItem,
  requireMeeting,
  requireWard,
  trimmedOrNullCapped,
  type Transaction,
} from "./rules.ts";

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

async function createOrLoadSundayMeetingRow(
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

  // Meetings are created without any item rows; items appear lazily once
  // the user enters real data for a virtual slot.
  return tx.sunday_meeting.upsert({
    where: { ward_id_date: { ward_id: wardId, date } },
    update: {},
    create: { ward_id: wardId, date, type },
  });
}

export async function createOrLoadSundayMeeting(
  wardId: string,
  date: string,
  requestedType?: SundayMeetingType,
) {
  return prisma.$transaction((tx) =>
    createOrLoadSundayMeetingRow(tx, wardId, date, requestedType),
  );
}

export async function createSundayMeetingBeforeEarliest(wardId: string) {
  return prisma.$transaction(async (tx) => {
    await requireWard(tx, wardId);
    const earliest = await tx.sunday_meeting.findFirst({
      where: { ward_id: wardId },
      orderBy: { date: "asc" },
      select: { date: true },
    });
    if (!earliest) fail("There is no persisted Sunday meeting to extend.");
    return createOrLoadSundayMeetingRow(tx, wardId, previousSunday(earliest.date));
  });
}

export async function createSundayMeetingAfterLatest(wardId: string) {
  return prisma.$transaction(async (tx) => {
    await requireWard(tx, wardId);
    const latest = await tx.sunday_meeting.findFirst({
      where: { ward_id: wardId },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    if (!latest) fail("There is no persisted Sunday meeting to extend.");
    return createOrLoadSundayMeetingRow(tx, wardId, nextSunday(latest.date));
  });
}

export async function bootstrapSundayMeeting(wardId: string) {
  return prisma.$transaction(async (tx) => {
    const ward = await requireWard(tx, wardId);
    const existing = await tx.sunday_meeting.findFirst({
      where: { ward_id: wardId },
      select: { id: true },
    });
    if (existing) {
      fail("The Sunday schedule already contains a persisted meeting.");
    }
    return createOrLoadSundayMeetingRow(
      tx,
      wardId,
      upcomingSunday(localToday(ward.time_zone)),
    );
  });
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
    const meeting = await requireMeeting(tx, wardId, meetingId);
    if (meeting.type === targetType) {
      return;
    }
    if (!isLocalMeetingType(targetType)) {
      const itemCount = await tx.sunday_meeting_item.count({
        where: { sunday_meeting_id: meetingId },
      });
      if (itemCount > 0) {
        fail("Conference meetings have no local agenda.");
      }
    }
    await tx.sunday_meeting.update({
      where: { id: meetingId },
      data: { type: targetType, updated_at: new Date() },
    });
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
      data: {
        information: trimmedOrNullCapped(
          information,
          MAX_ITEM_TEXT_LENGTH,
          "Meeting information",
        ),
        updated_at: new Date(),
      },
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

async function addTaskItemInTransaction(
  tx: Transaction,
  wardId: string,
  meetingId: string,
  taskId: string,
  itemType: SundayMeetingTaskItemType,
): Promise<string> {
  const meeting = await requireMeeting(tx, wardId, meetingId);
  if (!isLocalMeetingType(asMeetingType(meeting.type))) {
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

  const created = await tx.sunday_meeting_item.create({
    data: {
      sunday_meeting_id: meetingId,
      type: itemType,
      section: "business",
      order_index: null,
      task_id: taskId,
    },
  });
  return created.id;
}

export async function addTaskItem(
  wardId: string,
  meetingId: string,
  taskId: string,
  itemType: SundayMeetingTaskItemType,
): Promise<string> {
  return prisma.$transaction((tx) =>
    addTaskItemInTransaction(tx, wardId, meetingId, taskId, itemType),
  );
}

export async function carryForwardItem(
  wardId: string,
  itemId: string,
): Promise<{ destinationDate: string }> {
  return prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, wardId, itemId);
    const itemType = asItemType(item.type);
    if (!isCarryForwardEligible(itemType)) {
      fail("This agenda item cannot be carried forward.");
    }

    let destinationDate = nextSunday(item.sunday_meeting.date);
    let destination: Awaited<
      ReturnType<typeof createOrLoadSundayMeetingRow>
    > | null = null;
    for (let attempts = 0; attempts < 104; attempts += 1) {
      destination = await createOrLoadSundayMeetingRow(
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

    // A task presentation must not end up twice on the same meeting.
    if (item.task_id) {
      const duplicate = await tx.sunday_meeting_item.findFirst({
        where: {
          sunday_meeting_id: destination.id,
          task_id: item.task_id,
        },
        select: { id: true },
      });
      if (duplicate) {
        fail("This task is already on that meeting's agenda.");
      }
    }

    // The row moves as a whole; a null order_index lands it at the
    // destination's default position for its type and section.
    await tx.sunday_meeting_item.update({
      where: { id: item.id },
      data: {
        sunday_meeting_id: destination.id,
        order_index: null,
        updated_at: new Date(),
      },
    });

    return { destinationDate };
  });
}
