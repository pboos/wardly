import { syncStandardItems } from "./standard-items-service.ts";
import { isItemDataEmpty, nextPosition } from "./order.ts";
import { parseItemMetadata } from "./types.ts";
import {
  meetingSortableItems,
  normalizeMeetingOrder,
} from "./order-service.ts";
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
  isSundayMeetingType,
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

  const existing = await tx.sunday_meeting.findUnique({
    where: { ward_id_date: { ward_id: wardId, date } },
  });
  if (existing) return existing;

  const type = requestedType ?? (await defaultTypeForDate(tx, wardId, date));

  const meeting = await tx.sunday_meeting.upsert({
    where: { ward_id_date: { ward_id: wardId, date } },
    update: {},
    create: { ward_id: wardId, date, type },
  });
  await syncStandardItems(tx, meeting.id, asMeetingType(meeting.type));
  return meeting;
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
    return createOrLoadSundayMeetingRow(
      tx,
      wardId,
      previousSunday(earliest.date),
    );
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
      const items = await tx.sunday_meeting_item.findMany({
        where: { sunday_meeting_id: meetingId },
      });
      if (
        items.some(
          (item) =>
            !item.slot ||
            item.task_id ||
            !isItemDataEmpty({
              type: asItemType(item.type),
              content: item.content,
              metadata: parseItemMetadata(item.metadata),
              personMemberId: item.person_member_id,
              personName: item.person_name,
            }),
        )
      )
        fail("Clear the local agenda before changing to a conference meeting.");
    }
    await tx.sunday_meeting.update({
      where: { id: meetingId },
      data: { type: targetType, updated_at: new Date() },
    });
    await syncStandardItems(tx, meetingId, targetType);
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

    // Carry-forward appends to the destination section.
    await tx.sunday_meeting_item.update({
      where: { id: item.id },
      data: {
        sunday_meeting_id: destination.id,
        order_index: nextPosition(
          await meetingSortableItems(tx, destination.id),
          item.section as import("./types.ts").SundayMeetingSection,
        ),
        updated_at: new Date(),
      },
    });

    await normalizeMeetingOrder(tx, item.sunday_meeting_id);
    await normalizeMeetingOrder(tx, destination.id);
    return { destinationDate };
  });
}
