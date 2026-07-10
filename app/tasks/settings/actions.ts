"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { SEED_DEFAULTS } from "@/lib/tasks/default_seed";
import { parseConfiguration } from "@/lib/tasks/defaults";
import type { TaskTypeConfiguration } from "@/lib/tasks/types";

/**
 * Idempotent seeding of the ward's task defaults:
 *  - `task_type` rows for the five non-built-in types (skipping existing pairs).
 *  - `task_type_state` rows for each seeded type (skipping types that already
 *    have rows). States include `assign_to_user_id` (null by default).
 */
export async function seedTaskDefaults() {
  const user = await getCurrentUser();
  const wardId = user.ward_id;

  // 1. task_type rows
  const existingTypes = await prisma.task_type.findMany({
    where: { ward_id: wardId },
    select: { type: true },
  });
  const existingTypeSet = new Set(existingTypes.map((t) => t.type));
  const typesToInsert = SEED_DEFAULTS.filter((t) => !existingTypeSet.has(t.type));
  if (typesToInsert.length > 0) {
    await prisma.task_type.createMany({
      data: typesToInsert.map((t) => ({
        ward_id: wardId,
        type: t.type,
        name: t.name,
        name_short: t.name_short,
        color: t.color,
        configuration: JSON.stringify(t.configuration),
      })),
    });
  }

  // 2. task_type_state rows (skip types that already have rows)
  const existingStates = await prisma.task_type_state.findMany({
    where: { ward_id: wardId },
    select: { task_type: true },
    distinct: ["task_type"],
  });
  const existingStateTypes = new Set(existingStates.map((s) => s.task_type));
  const statesToInsert = SEED_DEFAULTS.flatMap((t) =>
    t.states.map((s) => ({ ...s, task_type: t.type })),
  ).filter((s) => !existingStateTypes.has(s.task_type));
  if (statesToInsert.length > 0) {
    await prisma.task_type_state.createMany({
      data: statesToInsert.map((s) => ({
        ward_id: wardId,
        task_type: s.task_type,
        state: s.state,
        label: s.label,
        color: s.color,
        order_index: s.order_index,
        is_final: s.is_final,
        assign_to_user_id: null,
      })),
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/tasks/settings");
}

/**
 * Deletes and re-seeds the ward's `task_type` and `task_type_state` rows.
 * The assignee configured on states is lost (reset to null).
 */
export async function resetTaskDefaults() {
  const user = await getCurrentUser();
  const wardId = user.ward_id;

  await prisma.$transaction([
    prisma.task_type.deleteMany({ where: { ward_id: wardId } }),
    prisma.task_type_state.deleteMany({ where: { ward_id: wardId } }),
  ]);

  await prisma.$transaction([
    prisma.task_type.createMany({
      data: SEED_DEFAULTS.map((t) => ({
        ward_id: wardId,
        type: t.type,
        name: t.name,
        name_short: t.name_short,
        color: t.color,
        configuration: JSON.stringify(t.configuration),
      })),
    }),
    prisma.task_type_state.createMany({
      data: SEED_DEFAULTS.flatMap((t) =>
        t.states.map((s) => ({
          ward_id: wardId,
          task_type: t.type,
          state: s.state,
          label: s.label,
          color: s.color,
          order_index: s.order_index,
          is_final: s.is_final,
          assign_to_user_id: null,
        })),
      ),
    }),
  ]);

  revalidatePath("/tasks");
  revalidatePath("/tasks/settings");
}

export async function updateTaskType(
  type: string,
  input: { name?: string; durationMinutes?: number },
) {
  const user = await getCurrentUser();
  const wardId = user.ward_id;

  const existing = await prisma.task_type.findUnique({
    where: { ward_id_type: { ward_id: wardId, type } },
  });

  const name = input.name?.trim();
  const config: TaskTypeConfiguration = existing
    ? parseConfiguration(existing.configuration)
    : { showTaskTitle: true };
  if (input.durationMinutes !== undefined) {
    config.durationMinutes = input.durationMinutes;
  }

  await prisma.task_type.upsert({
    where: { ward_id_type: { ward_id: wardId, type } },
    create: {
      ward_id: wardId,
      type,
      name: name ?? type,
      configuration: JSON.stringify(config),
    },
    update: {
      ...(name ? { name } : {}),
      configuration: JSON.stringify(config),
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/tasks/settings");
}

export async function updateStateAssignee(stateId: string, userId: string | null) {
  const user = await getCurrentUser();
  const wardId = user.ward_id;

  if (userId) {
    const assignee = await prisma.user.findUnique({
      where: { id: userId },
      select: { ward_id: true },
    });
    if (!assignee || assignee.ward_id !== wardId) {
      throw new Error("Invalid assignee.");
    }
  }

  await prisma.task_type_state.updateMany({
    where: { id: stateId, ward_id: wardId },
    data: { assign_to_user_id: userId, updated_at: new Date() },
  });

  revalidatePath("/tasks");
  revalidatePath("/tasks/settings");
}
