import type { Prisma } from "@/generated/prisma/client";
import {
  isSundayMeetingItemType,
  isSundayMeetingSection,
  isSundayMeetingType,
  type SundayItemMetadata,
  type SundayMeetingItemType,
  type SundayMeetingSection,
  type SundayMeetingType,
  type SundayPersonInput,
} from "./types.ts";
import { assertTimeZone } from "./calendar.ts";
import { sortSundayItems } from "./order.ts";

/**
 * Internal validation and access helpers shared by the meeting and item
 * service modules. Not part of the library's public API.
 */

export type Transaction = Prisma.TransactionClient;

/** Shape required by the pure ordering helpers in ./order. */
export type SortableItem = {
  id: string;
  type: SundayMeetingItemType;
  section: SundayMeetingSection;
  orderIndex: number | null;
  createdAt: string;
};

export function fail(message: string): never {
  throw new Error(message);
}

export function asMeetingType(value: string): SundayMeetingType {
  if (!isSundayMeetingType(value)) {
    return fail("Meeting has an invalid type.");
  }
  return value;
}

export function asItemType(value: string): SundayMeetingItemType {
  if (!isSundayMeetingItemType(value)) {
    return fail("Agenda item has an invalid type.");
  }
  return value;
}

export function asSection(value: string): SundayMeetingSection {
  if (!isSundayMeetingSection(value)) {
    return fail("Agenda item has an invalid section.");
  }
  return value;
}

/** Maximum length of free-text item content and meeting information. */
export const MAX_ITEM_TEXT_LENGTH = 10_000;

/** Maximum length of a free-text person name. */
export const MAX_PERSON_NAME_LENGTH = 200;

export function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Trimmed value that also enforces a maximum length with a clear error. */
export function trimmedOrNullCapped(
  value: string | null | undefined,
  maxLength: number,
  label: string,
): string | null {
  const trimmed = trimmedOrNull(value);
  if (trimmed && trimmed.length > maxLength) {
    return fail(`${label} must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

type RawSortableRow = {
  id: string;
  type: string;
  section: string;
  order_index: number | null;
  created_at: Date;
};

export function sortableItem(item: RawSortableRow): SortableItem {
  return {
    id: item.id,
    type: asItemType(item.type),
    section: asSection(item.section),
    orderIndex: item.order_index,
    createdAt: item.created_at.toISOString(),
  };
}

export function sortableList(items: readonly RawSortableRow[]): SortableItem[] {
  return items.map(sortableItem);
}

export type ResolvedPerson = {
  memberId: string | null;
  personName: string | null;
};

/** Member and free-text name are mutually exclusive; both empty is allowed. */
export function resolvePersonInput(
  person: SundayPersonInput | null | undefined,
): ResolvedPerson {
  if (!person) {
    return { memberId: null, personName: null };
  }
  const memberId = trimmedOrNull(person.memberId);
  const personName = trimmedOrNullCapped(
    person.personName,
    MAX_PERSON_NAME_LENGTH,
    "Free-text name",
  );
  if (memberId && personName) {
    fail("Choose either a ward member or a free-text name.");
  }
  return { memberId, personName };
}

/** Highest hymn number accepted; every published hymnbook stays far below. */
export const MAX_HYMN_NUMBER = 9999;

export function assertHymnNumber(metadata: SundayItemMetadata | null): void {
  const hymnNumber = metadata?.hymnNumber;
  if (hymnNumber === undefined || hymnNumber === null) {
    return;
  }
  if (
    !Number.isSafeInteger(hymnNumber) ||
    hymnNumber <= 0 ||
    hymnNumber > MAX_HYMN_NUMBER
  ) {
    fail(`Hymn number must be a whole number between 1 and ${MAX_HYMN_NUMBER}.`);
  }
}

/**
 * Serialize metadata. Only known keys are ever persisted — everything else a
 * client may have sent is dropped — and an all-empty object stores null.
 */
export function serializeMetadata(
  metadata: SundayItemMetadata | null | undefined,
): string | null {
  const hymnNumber = metadata?.hymnNumber;
  if (hymnNumber === undefined || hymnNumber === null) {
    return null;
  }
  return JSON.stringify({ hymnNumber });
}

export function assertTransitionEmpty(
  type: SundayMeetingItemType,
  content: string | null,
  metadata: string | null,
  person: ResolvedPerson,
): void {
  if (
    type === "transition" &&
    (content || metadata !== null || person.memberId || person.personName)
  ) {
    fail("A transition cannot contain text, a person, or metadata.");
  }
}

export function assertNoAdjacentConductorText(
  items: readonly SortableItem[],
): void {
  const ordered = sortSundayItems(items);
  for (let index = 1; index < ordered.length; index += 1) {
    if (
      ordered[index - 1].type === "conductor_text" &&
      ordered[index].type === "conductor_text"
    ) {
      fail("Two conductor-text items cannot be adjacent.");
    }
  }
}

/** The partial unique index backs this rule; the check gives a clean error. */
export async function assertSinglePersonItemType(
  tx: Transaction,
  meetingId: string,
  type: "leader" | "presiding",
  excludeItemId?: string,
): Promise<void> {
  const existing = await tx.sunday_meeting_item.findFirst({
    where: {
      sunday_meeting_id: meetingId,
      type,
      ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    fail(
      type === "leader"
        ? "This meeting already has a leader."
        : "This meeting already has a presiding authority.",
    );
  }
}

export async function requirePersonMember(
  tx: Transaction,
  wardId: string,
  memberId: string,
): Promise<void> {
  const member = await tx.member.findFirst({
    where: { id: memberId, ward_id: wardId },
    select: { id: true },
  });
  if (!member) {
    fail("Selected member does not belong to this ward.");
  }
}

export async function requireWard(
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

export async function requireMeeting(
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

export async function requireItem(
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

export async function meetingItems(tx: Transaction, meetingId: string) {
  return tx.sunday_meeting_item.findMany({
    where: { sunday_meeting_id: meetingId },
  });
}
