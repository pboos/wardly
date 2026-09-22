"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AuthFailure } from "@/lib/auth/action-result";

export function SessionRecoveryDialog({
  failure,
  message,
  checking,
  checkSession,
}: {
  failure: AuthFailure | null;
  message: string | null;
  checking: boolean;
  checkSession: () => Promise<void>;
}) {
  const changed = failure === "session_changed";
  return (
    <Dialog open={failure !== null}>
      <DialogContent
        className="max-w-[calc(100vw_-_2rem)]"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {changed ? "Your account changed" : "Your session expired"}
          </DialogTitle>
          <DialogDescription>
            {changed
              ? "Sign in with the original account and ward to continue. Your unsaved inputs remain in this tab."
              : "Log in in another tab, then return here and retry your change. Your unsaved inputs remain in this tab."}
          </DialogDescription>
        </DialogHeader>
        {message && (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => void checkSession()}
            disabled={checking}
          >
            {checking ? "Checking…" : "Check login"}
          </Button>
          <Button asChild>
            <a
              href={changed ? "/logout" : "/login?redirect=%2Fauth%2Fcomplete"}
              target="_blank"
              rel="noopener noreferrer"
            >
              {changed ? "Switch account in a new tab" : "Log in in a new tab"}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
