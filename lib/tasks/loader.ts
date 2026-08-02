import { prisma } from "@/lib/prisma";
import { DEFAULT_TASK_TYPES, parseConfiguration } from "./defaults";
import type { TaskType, TaskState, StateGroup } from "./types";
import { withProgress } from "./utils";

/**
 * Load all resolved task types for a ward.
 *
 * Code defaults are the starting point. Matching database type rows override
 * their metadata, and database state rows replace a default lifecycle only
 * when that ward has stored states for the type. Database-only types are
 * appended as custom types. State-assignment rows are finally overlaid onto
 * the resolved lifecycle by natural key.
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
export async function loadTaskTypes(wardId: string): Promise<TaskType[]> {
  const [taskTypeRows, stateRows, assignmentRows] = await Promise.all([
    prisma.task_type.findMany({
      where: { ward_id: wardId },
      orderBy: { type: "asc" },
    }),
    prisma.task_type_state.findMany({
      where: { ward_id: wardId },
      orderBy: [{ task_type: "asc" }, { order_index: "asc" }],
    }),
    prisma.task_type_state_assignment.findMany({
      where: { ward_id: wardId },
      select: { task_type: true, state: true, assign_to_user_id: true },
    }),
  ]);

  const statesByType = new Map<string, TaskState[]>();
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
      assign_to_user_id: null,
    });
    statesByType.set(s.task_type, list);
  }

  const assignmentsByType = new Map<string, Map<string, string | null>>();
  for (const assignment of assignmentRows) {
    const assignmentsByState = assignmentsByType.get(assignment.task_type) ?? new Map();
    assignmentsByState.set(assignment.state, assignment.assign_to_user_id);
    assignmentsByType.set(assignment.task_type, assignmentsByState);
  }

  function withAssignments(taskType: string, states: TaskState[]): TaskState[] {
    const assignmentsByState = assignmentsByType.get(taskType);

    return withProgress(
      states.map((state) => ({
        ...state,
        assign_to_user_id: assignmentsByState?.get(state.state) ?? null,
      })),
    );
  }

  const typeRowsByType = new Map(taskTypeRows.map((row) => [row.type, row]));
  const defaultTypeNames = new Set(DEFAULT_TASK_TYPES.map((type) => type.type));

  const defaultTypes = DEFAULT_TASK_TYPES.map((defaultType) => {
    const row = typeRowsByType.get(defaultType.type);
    const states = statesByType.get(defaultType.type) ?? defaultType.states;

    return {
      ...defaultType,
      ...(row
        ? {
            name: row.name,
            name_short: row.name_short,
            color: row.color,
            configuration: parseConfiguration(row.configuration, defaultType.configuration),
            enabled: row.enabled,
            source: "override" as const,
          }
        : {}),
      states: withAssignments(defaultType.type, states),
    };
  });

  const customTypes: TaskType[] = taskTypeRows
    .filter((row) => !defaultTypeNames.has(row.type))
    .map((row) => ({
      type: row.type,
      name: row.name,
      name_short: row.name_short,
      color: row.color,
      configuration: parseConfiguration(row.configuration),
      enabled: row.enabled,
      source: "custom",
      states: withAssignments(row.type, statesByType.get(row.type) ?? []),
    }));

  return [...defaultTypes, ...customTypes];
}
