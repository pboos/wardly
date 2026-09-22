"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  sameIdentity,
  type AuthFailure,
  type SessionIdentity,
} from "@/lib/auth/action-result";
import { SessionContext } from "@/lib/auth/session-context";
import { SessionRecoveryDialog } from "@/components/session-recovery-dialog";

export function SessionProvider({
  identity,
  children,
}: {
  identity: SessionIdentity | null;
  children: ReactNode;
}) {
  const [originalIdentity] = useState(identity);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);

  const onFailure = useCallback((reason: AuthFailure) => {
    if (reason === "forbidden") {
      toast.error("You do not have permission to perform this action.", {
        id: "auth-forbidden",
      });
    } else {
      setMessage(null);
      setFailure(reason);
    }
  }, []);
  const session = useMemo(
    () => ({ identity: originalIdentity, onFailure }),
    [originalIdentity, onFailure],
  );

  const checkSession = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) {
        setFailure("unauthenticated");
        setMessage("You are still signed out. Log in, then check again.");
        return;
      }
      if (response.status === 403) {
        setMessage("Access denied. Your account does not have permission.");
        return;
      }
      if (!response.ok) throw new Error("Session check failed");
      const current: SessionIdentity | null = await response.json();
      if (!sameIdentity(originalIdentity, current)) {
        setFailure("session_changed");
        return;
      }
      setFailure(null);
      toast.success("You’re logged in. Please retry your change.");
    } catch {
      setMessage(
        "Could not check your login. Check your connection and try again.",
      );
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, [originalIdentity]);

  useEffect(() => {
    if (!failure) return;
    const onFocus = () => {
      void checkSession();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [failure, checkSession]);

  return (
    <SessionContext.Provider value={session}>
      {children}
      <SessionRecoveryDialog
        failure={failure}
        message={message}
        checking={checking}
        checkSession={checkSession}
      />
    </SessionContext.Provider>
  );
}
