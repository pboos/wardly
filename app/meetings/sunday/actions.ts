"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  addSundayItem,
  bootstrapSundayMeeting,
  carryForwardItem,
  changeMeetingType,
  createSundayMeetingAfterLatest,
  createSundayMeetingBeforeEarliest,
  deleteSundayItem,
  moveSundayItem,
  updateMeetingInformation,
  updateSundayItem,
  updateSundayMeetingSettings,
  upsertSundayItem,
} from "@/lib/sunday-meetings/service";
import type {
  AddSundayItemInput,
  MoveSundayItemInput,
  UpdateSundayItemInput,
  UpsertSundayItemInput,
} from "@/lib/sunday-meetings/service";
import { addSuggestedTaskToMeeting } from "@/lib/sunday-meetings/tasks";
import type { SundayMeetingType } from "@/lib/sunday-meetings/types";

function revalidateSundayMeetingRoutes(): void {
  revalidatePath("/meetings/sunday");
  revalidatePath("/meetings/sunday/leading");
}

/**
 * Server actions receive untyped client payloads. Assert the object shape up
 * front so malformed input fails with a clear error; the service layer
 * validates the semantic rules (type/section membership, person XOR,
 * hymn number, …).
 */
function assertPlainObject(value: unknown, message: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
}

function assertOptionalText(value: unknown, message: string): void {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(message);
  }
}

function assertOptionalPerson(value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }
  assertPlainObject(value, "Person input must be an object.");
  const person = value as { memberId?: unknown; personName?: unknown };
  assertOptionalText(person.memberId, "Person member must be a member id.");
  assertOptionalText(person.personName, "Person name must be text.");
}

function assertOptionalMetadata(value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }
  assertPlainObject(value, "Item metadata must be an object.");
}

export async function updateSundayMeetingType(
  meetingId: string,
  type: SundayMeetingType,
) {
  const user = await getCurrentUser();
  await changeMeetingType(user.ward_id, meetingId, type);
  revalidateSundayMeetingRoutes();
}

export async function updateSundayMeetingInformation(
  meetingId: string,
  information: string | null,
) {
  const user = await getCurrentUser();
  await updateMeetingInformation(user.ward_id, meetingId, information);
  revalidateSundayMeetingRoutes();
}

export async function addSundayAgendaItem(
  meetingId: string,
  input: AddSundayItemInput,
) {
  assertPlainObject(input, "Agenda item input must be an object.");
  assertOptionalText(input.content, "Agenda item content must be text.");
  assertOptionalPerson(input.person);
  assertOptionalMetadata(input.metadata);
  assertOptionalText(input.afterItemId, "Agenda position must be an item id.");
  const user = await getCurrentUser();
  const id = await addSundayItem(user.ward_id, meetingId, input);
  revalidateSundayMeetingRoutes();
  return id;
}

export async function updateSundayAgendaItem(
  itemId: string,
  input: UpdateSundayItemInput,
) {
  assertPlainObject(input, "Agenda item input must be an object.");
  assertOptionalText(input.content, "Agenda item content must be text.");
  assertOptionalPerson(input.person);
  assertOptionalMetadata(input.metadata);
  const user = await getCurrentUser();
  await updateSundayItem(user.ward_id, itemId, input);
  revalidateSundayMeetingRoutes();
}

export async function deleteSundayAgendaItem(itemId: string) {
  const user = await getCurrentUser();
  await deleteSundayItem(user.ward_id, itemId);
  revalidateSundayMeetingRoutes();
}

/** Slot cells, leader, and presiding: find-first-by type+section, update or create. */
export async function upsertSundaySlotItem(
  meetingId: string,
  input: UpsertSundayItemInput,
) {
  assertPlainObject(input, "Slot item input must be an object.");
  assertOptionalText(input.content, "Slot item content must be text.");
  assertOptionalPerson(input.person);
  assertOptionalMetadata(input.metadata);
  const user = await getCurrentUser();
  await upsertSundayItem(user.ward_id, meetingId, input);
  revalidateSundayMeetingRoutes();
}

/** Places an agenda item after another item and/or into another section. */
export async function moveSundayAgendaItem(
  itemId: string,
  input: MoveSundayItemInput,
) {
  assertPlainObject(input, "Agenda move input must be an object.");
  assertOptionalText(input.afterItemId, "Agenda position must be an item id.");
  if (
    input.position !== undefined &&
    input.position !== "start" &&
    input.position !== "end"
  ) {
    throw new Error("Agenda position must be 'start' or 'end'.");
  }
  const user = await getCurrentUser();
  await moveSundayItem(user.ward_id, itemId, input);
  revalidateSundayMeetingRoutes();
}

export async function addSuggestedSundayTask(meetingId: string, taskId: string) {
  const user = await getCurrentUser();
  const id = await addSuggestedTaskToMeeting(user.ward_id, meetingId, taskId);
  revalidateSundayMeetingRoutes();
  return id;
}

export async function carrySundayAgendaItemForward(itemId: string) {
  const user = await getCurrentUser();
  const result = await carryForwardItem(user.ward_id, itemId);
  revalidateSundayMeetingRoutes();
  return result;
}

export async function updateSundayMeetingWardSettings(input: {
  contentLocale: string;
  timeZone: string;
}) {
  const user = await getCurrentUser();
  await updateSundayMeetingSettings(user.ward_id, input);
  revalidateSundayMeetingRoutes();
}

export async function addSundayMeetingBeforeEarliest() {
  const user = await getCurrentUser();
  await createSundayMeetingBeforeEarliest(user.ward_id);
  revalidateSundayMeetingRoutes();
}

export async function addSundayMeetingAfterLatest() {
  const user = await getCurrentUser();
  await createSundayMeetingAfterLatest(user.ward_id);
  revalidateSundayMeetingRoutes();
}

export async function bootstrapSundaySchedule() {
  const user = await getCurrentUser();
  await bootstrapSundayMeeting(user.ward_id);
  revalidateSundayMeetingRoutes();
}
