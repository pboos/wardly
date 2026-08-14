"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  addAgendaItem,
  addItemAssignment,
  addMeetingAssignment,
  carryForwardItem,
  changeMeetingType,
  deleteAgendaItem,
  removeAssignment,
  reorderAgenda,
  replaceItemAssignment,
  setMeetingLeader,
  setPresidingVisitor,
  updateAgendaItem,
  updateAssignment,
  updateMeetingInformation,
  updateSundayMeetingSettings,
  bootstrapSundayMeeting,
  createSundayMeetingAfterLatest,
  createSundayMeetingBeforeEarliest,
} from "@/lib/sunday-meetings/service";
import { addSuggestedTaskToMeeting } from "@/lib/sunday-meetings/tasks";
import type {
  AddAgendaItemInput,
  UpdateAgendaItemInput,
} from "@/lib/sunday-meetings/service";
import type {
  SundayMeetingAssignmentInput,
  SundayMeetingAssignmentRole,
  SundayMeetingItemAssignmentRole,
  SundayMeetingType,
} from "@/lib/sunday-meetings/types";

function revalidateSundayMeetingRoutes(): void {
  revalidatePath("/meetings/sunday");
  revalidatePath("/meetings/sunday/leading");
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
  input: AddAgendaItemInput,
) {
  const user = await getCurrentUser();
  const id = await addAgendaItem(user.ward_id, meetingId, input);
  revalidateSundayMeetingRoutes();
  return id;
}

export async function updateSundayAgendaItem(
  itemId: string,
  input: UpdateAgendaItemInput,
) {
  const user = await getCurrentUser();
  await updateAgendaItem(user.ward_id, itemId, input);
  revalidateSundayMeetingRoutes();
}

export async function deleteSundayAgendaItem(itemId: string) {
  const user = await getCurrentUser();
  await deleteAgendaItem(user.ward_id, itemId);
  revalidateSundayMeetingRoutes();
}

export async function reorderSundayAgenda(
  meetingId: string,
  orderedItemIds: string[],
) {
  const user = await getCurrentUser();
  await reorderAgenda(user.ward_id, meetingId, orderedItemIds);
  revalidateSundayMeetingRoutes();
}

export async function setSundayMeetingLeader(
  meetingId: string,
  input: SundayMeetingAssignmentInput | null,
) {
  const user = await getCurrentUser();
  await setMeetingLeader(user.ward_id, meetingId, input);
  revalidateSundayMeetingRoutes();
}

export async function addSundayMeetingPerson(
  meetingId: string,
  role: SundayMeetingAssignmentRole,
  input: SundayMeetingAssignmentInput,
) {
  const user = await getCurrentUser();
  const id = await addMeetingAssignment(user.ward_id, meetingId, role, input);
  revalidateSundayMeetingRoutes();
  return id;
}

export async function addSundayItemPerson(
  itemId: string,
  role: SundayMeetingItemAssignmentRole,
  input: SundayMeetingAssignmentInput,
) {
  const user = await getCurrentUser();
  const id = await addItemAssignment(user.ward_id, itemId, role, input);
  revalidateSundayMeetingRoutes();
  return id;
}

export async function replaceSundayItemPerson(
  itemId: string,
  role: SundayMeetingItemAssignmentRole,
  input: SundayMeetingAssignmentInput | null,
) {
  const user = await getCurrentUser();
  await replaceItemAssignment(user.ward_id, itemId, role, input);
  revalidateSundayMeetingRoutes();
}

export async function updateSundayPerson(
  assignmentId: string,
  input: SundayMeetingAssignmentInput,
) {
  const user = await getCurrentUser();
  await updateAssignment(user.ward_id, assignmentId, input);
  revalidateSundayMeetingRoutes();
}

export async function removeSundayPerson(assignmentId: string) {
  const user = await getCurrentUser();
  await removeAssignment(user.ward_id, assignmentId);
  revalidateSundayMeetingRoutes();
}

export async function setSundayPresidingVisitor(
  meetingId: string,
  assignmentId: string | null,
) {
  const user = await getCurrentUser();
  await setPresidingVisitor(user.ward_id, meetingId, assignmentId);
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
