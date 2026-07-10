import { prisma } from "@/lib/prisma";
import { parseConfiguration } from "./defaults";
import { BUILTIN_TASK_TYPES } from "./defaults";
import type { TaskTypeDef, TaskStateDef } from "./types";

/**
 * Load all task types for a ward: database rows merged with built-in types.
 *
 * 1. Query `task_type` and `task_type_state` for the ward.
 * 2. Map DB rows → `TaskTypeDef[]` (isBuiltIn: false), states sorted by
 *    `order_index` ascending.
 * 3. Append `BUILTIN_TASK_TYPES` (isBuiltIn: true).
 *
 * Returns a single array — the source of truth for what task types exist
 * for this ward.
 */
export async function loadTaskTypes(wardId: string): Promise<TaskTypeDef[]> {
  const [taskTypeRows, stateRows] = await Promise.all([
    prisma.task_type.findMany({ where: { ward_id: wardId } }),
    prisma.task_type_state.findMany({
      where: { ward_id: wardId },
      orderBy: [{ task_type: "asc" }, { order_index: "asc" }],
    }),
  ]);

  const statesByType = new Map<string, TaskStateDef[]>();
  for (const s of stateRows) {
    const list = statesByType.get(s.task_type) ?? [];
    list.push({
      id: s.id,
      state: s.state,
      label: s.label,
      color: s.color,
      order_index: s.order_index,
      is_final: s.is_final,
      assign_to_user_id: s.assign_to_user_id,
    });
    statesByType.set(s.task_type, list);
  }

  const dbTypes: TaskTypeDef[] = taskTypeRows.map((row) => ({
    type: row.type,
    name: row.name,
    name_short: row.name_short,
    color: row.color,
    configuration: parseConfiguration(row.configuration),
    isBuiltIn: false,
    states: statesByType.get(row.type) ?? [],
  }));

  return [...dbTypes, ...BUILTIN_TASK_TYPES];
}
