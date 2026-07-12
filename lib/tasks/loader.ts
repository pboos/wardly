import { prisma } from "@/lib/prisma";
import { parseConfiguration, BUILTIN_TASK_TYPES } from "./defaults";
import type { TaskTypeDef, TaskStateDef, StateGroup } from "./types";

/**
 * Load all task types for a ward: database rows merged with built-in types.
 *
 * 1. Query `task_type` and `task_type_state` for the ward.
 * 2. Map DB rows → `TaskTypeDef[]` (isBuiltIn: false), states sorted by
 *    `order_index` ascending.
 * 3. Append `BUILTIN_TASK_TYPES` (isBuiltIn: true).
 *
 * `progress_percentage` is calculated for active states:
 *   step = 1 / (nr_of_active_states + 1)
 *   first active state  → step
 *   last active state   → 1 - step
 *   evenly spaced in between.
 * `not_started` states get 0, `closed` states get 1.
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
      state_group: s.state_group as StateGroup,
      progress_percentage: 0,
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
    states: withProgress(statesByType.get(row.type) ?? []),
  }));

  const builtIn = BUILTIN_TASK_TYPES.map((t) => ({
    ...t,
    states: withProgress(t.states),
  }));

  return [...dbTypes, ...builtIn];
}

/**
 * Calculate `progress_percentage` for active states in a state list.
 * `not_started` → 0, `closed` → 1. Active states are spaced evenly between
 * `step` and `1 - step` where `step = 1 / (nr_active + 1)`.
 */
function withProgress(states: TaskStateDef[]): TaskStateDef[] {
  const activeIndices = states
    .map((s, i) => (s.state_group === "active" ? i : -1))
    .filter((i) => i >= 0);
  const nrActive = activeIndices.length;
  // +1 because 100% is the "closed" status
  const step = nrActive > 0 ? 1 / (nrActive + 1) : 0;

  return states.map((s, i) => {
    if (s.state_group === "not_started") return { ...s, progress_percentage: 0 };
    if (s.state_group === "closed") return { ...s, progress_percentage: 1 };
    const pos = activeIndices.indexOf(i);
    return { ...s, progress_percentage: step * (pos + 1) };
  });
}
