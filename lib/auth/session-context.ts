"use client";

import { createContext, useContext } from "react";
import type { SessionRecovery } from "./action-result";

export const SessionContext = createContext<SessionRecovery | null>(null);

export function useSessionRecovery(): SessionRecovery {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useAppMutation requires a SessionProvider.");
  return session;
}
