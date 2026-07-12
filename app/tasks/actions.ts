"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { loadTaskTypes } from "@/lib/tasks/loader";
import { findStateDef, findTypeDef, getPreviousState } from "@/lib/tasks/utils";

export async function createTask(input: {
  type: string;
  title?: string | null;
  memberId?: string | null;
  assignedUserId?: string | null;
  description?: string | null;
}) {
  const user = await getCurrentUser();
  const taskTypes = await loadTaskTypes(user.ward_id);
  const typeDef = findTypeDef(taskTypes, input.type);
  if (!typeDef) throw new Error(`Unknown task type "${input.type}".`);

  const title = input.title?.trim() || null;
  const memberId = input.memberId || null;
  const assignedUserId = input.assignedUserId || null;
  const description = input.description?.trim() || null;

  if (!title && !memberId) {
    throw new Error("A task requires either a title or a member.");
  }

  // Validate member + assignee belong to the ward when provided.
  if (memberId) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { ward_id: true },
    });
    if (!member || member.ward_id !== user.ward_id) {
      throw new Error("Invalid member.");
    }
  }
  if (assignedUserId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedUserId },
      select: { ward_id: true },
    });
    if (!assignee || assignee.ward_id !== user.ward_id) {
      throw new Error("Invalid assignee.");
    }
  }

  const durationMinutes = typeDef.configuration.durationMinutes ?? null;

  await prisma.task.create({
    data: {
      ward_id: user.ward_id,
      type: input.type,
      state: "todo",
      title,
      description,
      assigned_user_id: assignedUserId,
      member_id: memberId,
      duration_minutes: durationMinutes,
    },
  });

  revalidatePath("/tasks");
}

export async function changeTaskState(taskId: string, toState: string) {
  const user = await getCurrentUser();

  const task = await prisma.task.findFirst({
    where: { id: taskId, ward_id: user.ward_id },
    select: { id: true, type: true, state: true },
  });
  if (!task) throw new Error("Task not found.");

  const taskTypes = await loadTaskTypes(user.ward_id);
  const typeDef = findTypeDef(taskTypes, task.type);
  if (!typeDef) throw new Error("Task type not found.");

  const targetState = findStateDef(typeDef, toState);
  if (!targetState) throw new Error(`Unknown state "${toState}".`);

  const assignToUserId = targetState.assign_to_user_id;

  await prisma.task.update({
    where: { id: task.id },
    data: {
      state: toState,
      completed_at: targetState.state_group === "closed" ? new Date().toISOString() : null,
      ...(assignToUserId !== null ? { assigned_user_id: assignToUserId } : {}),
      updated_at: new Date(),
    },
  });

  revalidatePath("/tasks");
}

export async function updateTaskAssignee(taskId: string, assignedUserId: string | null) {
  const user = await getCurrentUser();

  if (assignedUserId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedUserId },
      select: { ward_id: true },
    });
    if (!assignee || assignee.ward_id !== user.ward_id) {
      throw new Error("Invalid assignee.");
    }
  }

  await prisma.task.updateMany({
    where: { id: taskId, ward_id: user.ward_id },
    data: { assigned_user_id: assignedUserId, updated_at: new Date() },
  });

  revalidatePath("/tasks");
}

export async function updateTaskMember(taskId: string, memberId: string | null) {
  const user = await getCurrentUser();

  if (memberId) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { ward_id: true },
    });
    if (!member || member.ward_id !== user.ward_id) {
      throw new Error("Invalid member.");
    }
  }

  await prisma.task.updateMany({
    where: { id: taskId, ward_id: user.ward_id },
    data: { member_id: memberId, updated_at: new Date() },
  });

  revalidatePath("/tasks");
}

export async function updateTaskTitle(taskId: string, title: string | null) {
  const user = await getCurrentUser();
  await prisma.task.updateMany({
    where: { id: taskId, ward_id: user.ward_id },
    data: { title: title?.trim() || null, updated_at: new Date() },
  });
  revalidatePath("/tasks");
}

export async function updateTaskDescription(taskId: string, description: string | null) {
  const user = await getCurrentUser();
  await prisma.task.updateMany({
    where: { id: taskId, ward_id: user.ward_id },
    data: { description: description?.trim() || null, updated_at: new Date() },
  });
  revalidatePath("/tasks");
}

export async function deleteTask(taskId: string) {
  const user = await getCurrentUser();
  await prisma.task.deleteMany({
    where: { id: taskId, ward_id: user.ward_id },
  });
  revalidatePath("/tasks");
}

export async function reopenTask(taskId: string) {
  const user = await getCurrentUser();

  const task = await prisma.task.findFirst({
    where: { id: taskId, ward_id: user.ward_id },
    select: { id: true, type: true, state: true },
  });
  if (!task) throw new Error("Task not found.");

  const taskTypes = await loadTaskTypes(user.ward_id);
  const typeDef = findTypeDef(taskTypes, task.type);
  if (!typeDef) throw new Error("Task type not found.");

  const current = findStateDef(typeDef, task.state);
  const newState = current?.state_group === "closed"
    ? (getPreviousState(typeDef, task.state)?.state ?? task.state)
    : task.state;

  await prisma.task.update({
    where: { id: task.id },
    data: {
      completed_at: null,
      state: newState,
      updated_at: new Date(),
    },
  });

  revalidatePath("/tasks");
}
