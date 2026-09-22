"use client";

import { useCallback, useState } from "react";
import { useSessionRecovery } from "@/lib/auth/session-context";
import { executeAction, type AppAction } from "./execute-action";

/** Bind a protected action to this React tree's session; no global client state. */
export function useAppMutation<Args extends unknown[], T>(
  action: AppAction<Args, T>,
) {
  const session = useSessionRecovery();
  const [pendingCount, setPendingCount] = useState(0);
  const execute = useCallback(
    async (...args: Args): Promise<T> => {
      setPendingCount((count) => count + 1);
      try {
        return await executeAction(action, session, ...args);
      } finally {
        setPendingCount((count) => count - 1);
      }
    },
    [action, session],
  );
  return { execute, isPending: pendingCount > 0 };
}
