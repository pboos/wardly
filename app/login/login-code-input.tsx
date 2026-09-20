"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export function LoginCodeInput({ pending }: { pending: boolean }) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <InputOTP
      ref={inputRef}
      id="code"
      name="code"
      required
      autoFocus
      minLength={6}
      maxLength={6}
      inputMode="text"
      autoComplete="one-time-code"
      pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
      value={code}
      onChange={(value) => setCode(value.toUpperCase())}
      onComplete={() => {
        if (!pending) inputRef.current?.form?.requestSubmit();
      }}
      disabled={pending}
      containerClassName="justify-center"
      onPasteCapture={(event) => {
        const pasted = event.clipboardData.getData("text/plain").trim();
        if (!/^[a-zA-Z0-9]{6}$/.test(pasted)) return;
        event.preventDefault();
        event.stopPropagation();
        if (pending) return;
        const form = event.currentTarget.form;
        // Commit the pasted value before the form collects its FormData.
        flushSync(() => setCode(pasted.toUpperCase()));
        form?.requestSubmit();
      }}
    >
      <InputOTPGroup className="gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-11 w-8 rounded-md border-l sm:w-10"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
