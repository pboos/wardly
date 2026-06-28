"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  const errorMessage = state.status === "error" ? state.message : undefined;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Log in</CardTitle>
        <CardDescription>
          {showCode
            ? "Enter the code we sent to your email."
            : "Enter your email to receive a login code."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={dispatch} className="w-full">
          <FieldGroup>
            {!showCode && (
              <Field data-invalid={!!errorMessage}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={!!errorMessage}
                />
                {errorMessage && <FieldError>{errorMessage}</FieldError>}
              </Field>
            )}

            {showCode && (
              <>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-character code to {state.email}. Enter it below
                  or click the link in the email.
                </p>
                <input type="hidden" name="email" value={state.email} />
                <Field data-invalid={!!errorMessage}>
                  <FieldLabel htmlFor="code">Code</FieldLabel>
                  <Input
                    id="code"
                    name="code"
                    required
                    autoFocus
                    maxLength={6}
                    inputMode="text"
                    autoComplete="one-time-code"
                    placeholder="ABC123"
                    className="text-center tracking-[0.5em] uppercase"
                    aria-invalid={!!errorMessage}
                  />
                  {errorMessage && <FieldError>{errorMessage}</FieldError>}
                </Field>
              </>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {showCode ? "Verify" : "Log in"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
