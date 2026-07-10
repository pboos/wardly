import type { TaskTypeDef, TaskStateDef } from "./types";

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
