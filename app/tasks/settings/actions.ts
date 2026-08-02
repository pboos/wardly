"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TASK_TYPES, parseConfiguration } from "@/lib/tasks/defaults";
import { loadTaskTypes } from "@/lib/tasks/loader";
import type { TaskTypeConfiguration } from "@/lib/tasks/types";
import { findTaskState, findTaskType } from "@/lib/tasks/utils";

export async function updateTaskType(
  type: string,
  input: { name?: string; durationMinutes?: number },
) {
  const user = await getCurrentUser();
  const wardId = user.ward_id;

  const existing = await prisma.task_type.findUnique({
    where: { ward_id_type: { ward_id: wardId, type } },
  });
  if (!existing) {
    throw new Error("Task types cannot be created from settings.");
  }

  const name = input.name?.trim();
  const defaultConfiguration = DEFAULT_TASK_TYPES.find(
    (defaultType) => defaultType.type === type,
  )?.configuration;
  const config: TaskTypeConfiguration = parseConfiguration(
    existing.configuration,
    defaultConfiguration,
  );
  if (input.durationMinutes !== undefined) {
    config.durationMinutes = input.durationMinutes;
  }

  await prisma.task_type.update({
    where: { ward_id_type: { ward_id: wardId, type } },
    data: {
      ...(name ? { name } : {}),
      configuration: JSON.stringify(config),
      updated_at: new Date(),
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/tasks/settings");
}

export async function updateStateAssignee(
  taskType: string,
  state: string,
  userId: string | null,
) {
  const user = await getCurrentUser();
  const wardId = user.ward_id;

  const taskTypes = await loadTaskTypes(wardId);
  const typeDef = findTaskType(taskTypes, taskType);
  if (!typeDef || !findTaskState(typeDef, state)) {
    throw new Error("Task state not found.");
  }

  if (userId) {
    const assignee = await prisma.user.findUnique({
      where: { id: userId },
      select: { ward_id: true },
    });
    if (!assignee || assignee.ward_id !== wardId) {
      throw new Error("Invalid assignee.");
    }
  }

  if (userId) {
    await prisma.task_type_state_assignment.upsert({
      where: {
        ward_id_task_type_state: { ward_id: wardId, task_type: taskType, state },
      },
      create: {
        ward_id: wardId,
        task_type: taskType,
        state,
        assign_to_user_id: userId,
      },
      update: { assign_to_user_id: userId, updated_at: new Date() },
    });
  } else {
    await prisma.task_type_state_assignment.deleteMany({
      where: { ward_id: wardId, task_type: taskType, state },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/tasks/settings");
}
