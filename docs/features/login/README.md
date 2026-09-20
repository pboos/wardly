# Login

The login screen requests an email code, then verifies the six-character code
or lets the user follow the existing email link.

- Email receives focus when the login screen opens; code receives focus after
  requesting an email.
- The code uses six separate visual boxes backed by one accessible input.
  Letters and numbers are accepted and displayed in uppercase. Native typing,
  selection, Backspace, partial paste, and one-time-code autofill are supported.
- Pasting a complete six-character alphanumeric code replaces the current value
  and submits automatically. Surrounding whitespace is trimmed. Typing or
  autofilling the sixth character also submits automatically. Verify and Enter
  remain available, and incomplete values cannot submit.
- Verification disables the code control and button; duplicate submissions are
  ignored while a request is running.
- Verification errors currently return to the email step to request another code.
- See [local development](../local-development/README.md) for email-free demo login.

## Implementation

- [Login form](../../../app/login/login-form.tsx): steps, focus, and submission.
- [Code input](../../../app/login/login-code-input.tsx): slots and paste handling.
- [Server actions](../../../app/login/actions.ts): request and verification.
- [Auth constants](../../../lib/auth/constants.ts): login/session lifetimes.

Verify keyboard entry, single-character deletion, complete/partial paste,
single-request submission, and layout at narrow mobile widths in a browser.
