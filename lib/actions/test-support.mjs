import { executeAction } from "./execute-action.ts";

// Exercise the real action guard and result handling in persistence tests.
export function bindActionsForTest(actions, identity) {
  const session = { identity, onFailure() {} };
  return Object.fromEntries(
    Object.entries(actions).map(([name, action]) => [
      name,
      (...args) => executeAction(action, session, ...args),
    ]),
  );
}
