import type { StateGroup, TaskType, TaskState } from "./types";

type DefaultTaskType = Omit<TaskType, "states"> & {
  states: Array<Omit<TaskState, "order_index" | "progress_percentage">>;
};

/** Add state order and progress values implied by a default definition's order. */
export function withDefaultStateValues(
  taskTypes: DefaultTaskType[],
): TaskType[] {
  return taskTypes.map((taskType) => ({
    ...taskType,
    states: withProgress(
      taskType.states.map((state, order_index) => ({ ...state, order_index })),
    ),
  }));
}

/** Calculate progress from state groups, spacing active states evenly from 0 to 1. */
export function withProgress<T extends { state_group: StateGroup }>(
  states: T[],
): Array<T & Pick<TaskState, "progress_percentage">> {
  const activeCount = states.filter((state) => state.state_group === "active").length;
  const step = activeCount > 0 ? 1 / (activeCount + 1) : 0;
  let activePosition = 0;

  return states.map((state) => {
    const progress_percentage =
      state.state_group === "not_started"
        ? 0
        : state.state_group === "closed"
          ? 1
          : step * ++activePosition;

    return { ...state, progress_percentage };
  });
}

/** Find a task type definition by its `type` string. */
export function findTaskType(types: TaskType[], type: string): TaskType | undefined {
  return types.find((t) => t.type === type);
}

/** Find a state definition within a task type by its `state` string. */
export function findTaskState(typeDef: TaskType, state: string): TaskState | undefined {
  return typeDef.states.find((s) => s.state === state);
}

/** Next state by `order_index`, or `null` if already at the last state. */
export function getNextState(typeDef: TaskType, currentState: string): TaskState | null {
  const states = typeDef.states;
  const idx = states.findIndex((s) => s.state === currentState);
  if (idx === -1 || idx >= states.length - 1) return null;
  return states[idx + 1];
}

/** Previous state by `order_index`, or `null` if at the first state. */
export function getPreviousState(typeDef: TaskType, currentState: string): TaskState | null {
  const states = typeDef.states;
  const idx = states.findIndex((s) => s.state === currentState);
  if (idx <= 0) return null;
  return states[idx - 1];
}
