"use client";

import { useActionState, useRef } from "react";
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
import { LoginCodeInput } from "./login-code-input";
import { requestLogin, verifyCode, type LoginState } from "./actions";

export function LoginForm({
  redirect,
  localCode,
}: {
  redirect: string;
  localCode?: string;
}) {
  const submitting = useRef(false);
  const [state, dispatch, pending] = useActionState<LoginState, FormData>(
    async (prev, fd) => {
      try {
        if (prev.status === "email_sent") return await verifyCode(prev, fd);
        return await requestLogin(prev, fd);
      } finally {
        submitting.current = false;
      }
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
          {localCode
            ? `Local development: use code ${localCode}. No email is sent.`
            : showCode
              ? "Enter the code we sent to your email."
              : "Enter your email to receive a login code."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={dispatch}
          className="w-full"
          onSubmit={(event) => {
            if (submitting.current || pending) {
              event.preventDefault();
              return;
            }
            submitting.current = true;
          }}
        >
          <input type="hidden" name="redirect" value={redirect} />
          <FieldGroup>
            {!showCode && (
              <Field data-invalid={!!errorMessage}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  required
                  autoFocus
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
                  {localCode
                    ? `Enter ${localCode} to log in as ${state.email}.`
                    : `We sent a 6-character code to ${state.email}. Enter it below or click the link in the email.`}
                </p>
                <input type="hidden" name="email" value={state.email} />
                <Field data-invalid={!!errorMessage}>
                  <FieldLabel htmlFor="code">Code</FieldLabel>
                  <LoginCodeInput pending={pending} />
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
