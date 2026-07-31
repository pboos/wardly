import type { StateGroup, TaskTypeDef, TaskStateDef } from "./types";

type DefaultTaskTypeDef = Omit<TaskTypeDef, "states"> & {
  states: Array<Omit<TaskStateDef, "order_index" | "progress_percentage">>;
};

/** Add state order and progress values implied by a default definition's order. */
export function withDefaultStateValues(
  taskTypes: DefaultTaskTypeDef[],
): TaskTypeDef[] {
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
): Array<T & Pick<TaskStateDef, "progress_percentage">> {
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
export function findTypeDef(types: TaskTypeDef[], type: string): TaskTypeDef | undefined {
  return types.find((t) => t.type === type);
}

/** Find a state definition within a task type by its `state` string. */
export function findStateDef(typeDef: TaskTypeDef, state: string): TaskStateDef | undefined {
  return typeDef.states.find((s) => s.state === state);
}

/** Next state by `order_index`, or `null` if already at the last state. */
export function getNextState(typeDef: TaskTypeDef, currentState: string): TaskStateDef | null {
  const states = typeDef.states;
  const idx = states.findIndex((s) => s.state === currentState);
  if (idx === -1 || idx >= states.length - 1) return null;
  return states[idx + 1];
}

/** Previous state by `order_index`, or `null` if at the first state. */
export function getPreviousState(typeDef: TaskTypeDef, currentState: string): TaskStateDef | null {
  const states = typeDef.states;
  const idx = states.findIndex((s) => s.state === currentState);
  if (idx <= 0) return null;
  return states[idx - 1];
}
