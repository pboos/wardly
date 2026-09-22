"use server";

import { revalidatePath } from "next/cache";
import { authenticatedAction } from "@/lib/auth/action";
import type { SessionIdentity } from "@/lib/auth/action-result";
import {
  addSundayItem,
  addSacramentPerson,
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
import {
  addSuggestedTaskToMeeting,
  addSuggestedTasksToMeeting,
} from "@/lib/sunday-meetings/tasks";
import type {
  SundayPersonInput,
  SundayMeetingType,
} from "@/lib/sunday-meetings/types";

function revalidateSundayMeetingRoutes(): void {
  revalidatePath("/meetings/sunday");
  revalidatePath("/meetings/sunday/[date]", "page");
  revalidatePath("/meetings/sunday/upcoming");
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
  identity: SessionIdentity | null,
  meetingId: string,
  type: SundayMeetingType,
) {
  return authenticatedAction(identity, async (user) => {
    await changeMeetingType(user.ward_id, meetingId, type);
    revalidateSundayMeetingRoutes();
  });
}

export async function updateSundayMeetingInformation(
  identity: SessionIdentity | null,
  meetingId: string,
  information: string | null,
) {
  return authenticatedAction(identity, async (user) => {
    await updateMeetingInformation(user.ward_id, meetingId, information);
    revalidateSundayMeetingRoutes();
  });
}

export async function addSundayAgendaItem(
  identity: SessionIdentity | null,
  meetingId: string,
  input: AddSundayItemInput,
) {
  return authenticatedAction(identity, async (user) => {
    assertPlainObject(input, "Agenda item input must be an object.");
    assertOptionalText(input.content, "Agenda item content must be text.");
    assertOptionalPerson(input.person);
    assertOptionalMetadata(input.metadata);
    assertOptionalText(
      input.afterItemId,
      "Agenda position must be an item id.",
    );
    const id = await addSundayItem(user.ward_id, meetingId, input);
    revalidateSundayMeetingRoutes();
    return id;
  });
}

export async function updateSundayAgendaItem(
  identity: SessionIdentity | null,
  itemId: string,
  input: UpdateSundayItemInput,
) {
  return authenticatedAction(identity, async (user) => {
    assertPlainObject(input, "Agenda item input must be an object.");
    assertOptionalText(input.content, "Agenda item content must be text.");
    assertOptionalPerson(input.person);
    assertOptionalMetadata(input.metadata);
    await updateSundayItem(user.ward_id, itemId, input);
    revalidateSundayMeetingRoutes();
  });
}

export async function deleteSundayAgendaItem(
  identity: SessionIdentity | null,
  itemId: string,
) {
  return authenticatedAction(identity, async (user) => {
    await deleteSundayItem(user.ward_id, itemId);
    revalidateSundayMeetingRoutes();
  });
}

/** Slot cells, leader, and presiding: find-first-by type+section, update or create. */
export async function upsertSundaySlotItem(
  identity: SessionIdentity | null,
  meetingId: string,
  input: UpsertSundayItemInput,
) {
  return authenticatedAction(identity, async (user) => {
    assertPlainObject(input, "Slot item input must be an object.");
    assertOptionalText(input.content, "Slot item content must be text.");
    assertOptionalPerson(input.person);
    assertOptionalMetadata(input.metadata);
    await upsertSundayItem(user.ward_id, meetingId, input);
    revalidateSundayMeetingRoutes();
  });
}

/** Move one visible entry, or explicitly move an extra entry to another section. */
export async function moveSundayAgendaItem(
  identity: SessionIdentity | null,
  itemId: string,
  input: MoveSundayItemInput,
) {
  return authenticatedAction(identity, async (user) => {
    assertPlainObject(input, "Agenda move input must be an object.");
    await moveSundayItem(user.ward_id, itemId, input);
    revalidateSundayMeetingRoutes();
  });
}

export async function addSuggestedSundayTask(
  identity: SessionIdentity | null,
  meetingId: string,
  taskId: string,
) {
  return authenticatedAction(identity, async (user) => {
    const id = await addSuggestedTaskToMeeting(user.ward_id, meetingId, taskId);
    revalidateSundayMeetingRoutes();
    return id;
  });
}

export async function addSuggestedSundayTasks(
  identity: SessionIdentity | null,
  meetingId: string,
  taskIds: string[],
) {
  return authenticatedAction(identity, async (user) => {
    const ids = await addSuggestedTasksToMeeting(
      user.ward_id,
      meetingId,
      taskIds,
    );
    revalidateSundayMeetingRoutes();
    return ids;
  });
}

export async function carrySundayAgendaItemForward(
  identity: SessionIdentity | null,
  itemId: string,
) {
  return authenticatedAction(identity, async (user) => {
    const result = await carryForwardItem(user.ward_id, itemId);
    revalidateSundayMeetingRoutes();
    return result;
  });
}

export async function updateSundayMeetingWardSettings(
  identity: SessionIdentity | null,
  input: {
    contentLocale: string;
    timeZone: string;
  },
) {
  return authenticatedAction(identity, async (user) => {
    await updateSundayMeetingSettings(user.ward_id, input);
    revalidateSundayMeetingRoutes();
  });
}

export async function addSundayMeetingBeforeEarliest(
  identity: SessionIdentity | null,
) {
  return authenticatedAction(identity, async (user) => {
    await createSundayMeetingBeforeEarliest(user.ward_id);
    revalidateSundayMeetingRoutes();
  });
}

export async function addSundayMeetingAfterLatest(
  identity: SessionIdentity | null,
) {
  return authenticatedAction(identity, async (user) => {
    await createSundayMeetingAfterLatest(user.ward_id);
    revalidateSundayMeetingRoutes();
  });
}

export async function bootstrapSundaySchedule(
  identity: SessionIdentity | null,
) {
  return authenticatedAction(identity, async (user) => {
    await bootstrapSundayMeeting(user.ward_id);
    revalidateSundayMeetingRoutes();
  });
}

export async function addSundaySacramentPerson(
  identity: SessionIdentity | null,
  itemId: string,
  person: SundayPersonInput,
) {
  return authenticatedAction(identity, async (user) => {
    assertOptionalPerson(person);
    await addSacramentPerson(user.ward_id, itemId, person);
    revalidateSundayMeetingRoutes();
  });
}
