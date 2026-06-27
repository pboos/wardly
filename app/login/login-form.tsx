"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { requestLogin, verifyCode, type LoginState } from "./actions";

export function LoginForm() {
  const [state, dispatch, pending] = useActionState<LoginState, FormData>(
    async (prev, fd) => {
      // Route to the right action based on current state.
      if (prev.status === "email_sent") return verifyCode(prev, fd);
      return requestLogin(prev, fd);
    },
    { status: "idle" },
  );

  const showCode = state.status === "email_sent";

  return (
    <form action={dispatch} className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Log in</h1>

      {!showCode && (
        <>
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-md border px-3 py-2"
          />
          <Button type="submit" className="w-full" disabled={pending}>
            Log in
          </Button>
        </>
      )}

      {showCode && (
        <>
          <p className="text-sm text-muted-foreground">
            We sent a 6-character code to {state.email}. Enter it below or
            click the link in the email.
          </p>
          <input type="hidden" name="email" value={state.email} />
          <input
            name="code"
            required
            autoFocus
            maxLength={6}
            placeholder="ABC123"
            className="w-full rounded-md border px-3 py-2 text-center tracking-[0.5em] uppercase"
          />
          <Button type="submit" className="w-full" disabled={pending}>
            Verify
          </Button>
        </>
      )}

      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
