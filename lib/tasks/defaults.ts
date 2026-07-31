import type { TaskTypeDef, TaskTypeConfiguration } from "./types";
import { withDefaultStateValues } from "./utils";

/**
 * Built-in task types that are never stored in the database. They are always
 * available for every ward, merged into the result of `loadTaskTypes`.
 */
export const BUILTIN_TASK_TYPES: TaskTypeDef[] = withDefaultStateValues([
  {
    type: "todo",
    name: "Task",
    name_short: "T",
    color: "#71717a",
    configuration: { showTaskTitle: true },
    isBuiltIn: true,
    states: [
      { state: "todo", label: "To do", color: "#3b82f6", state_group: "not_started", assign_to_user_id: null },
      { state: "done", label: "Done", color: "#22c55e", state_group: "closed", assign_to_user_id: null },
    ],
  },
]);

/** Parse a `task_type.configuration` JSON string into a typed configuration. */
export function parseConfiguration(json: string | null | undefined): TaskTypeConfiguration {
  try {
    const parsed = JSON.parse(json ?? "{}");
    return {
      durationMinutes:
        typeof parsed.durationMinutes === "number" ? parsed.durationMinutes : undefined,
      showTaskTitle: typeof parsed.showTaskTitle === "boolean" ? parsed.showTaskTitle : true,
    };
  } catch {
    return { showTaskTitle: true };
  }
}
