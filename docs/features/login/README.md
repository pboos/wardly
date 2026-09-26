# Login

The login screen requests an email code, then verifies the six-character code
or lets the user follow the existing email link.

- Email receives focus when the login screen opens; code receives focus after
  requesting an email.
- **Remember email** is unchecked by default. Checking it immediately saves the
  email in this browser's `localStorage` (`wardly:remembered-email`); edits update
  the saved value. Returning to login restores the email and checked state.
  Unchecking removes the saved value without clearing the current input. Only
  the email is remembered; login still requires a code. If storage is unavailable,
  login remains usable but the preference cannot persist.
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

## Session recovery

Expired sessions during edits show one shared dialog and preserve mounted inputs.
Users log in in a new tab, return to the original tab, and explicitly retry the
failed action. Focus/visibility changes and **Check login** verify the current
session with the server; no mutation is automatically replayed. Network failures
keep the dialog open with retry feedback. Drafts are held only in memory and do
not survive a reload or closing the tab.

A different user or ward cannot submit an old tab’s draft: every protected action
compares the tab’s identity with the database-backed session before doing work.
The dialog offers switching accounts in another tab; the original account and
ward must match before continuing. Permission failures remain access-denied
feedback, not login prompts. Existing domain/ward ownership errors keep their
normal validation messages; Wardly has no separate admin role.

Page navigation without authentication still redirects to login, with the proxy
preserving the destination. Protected API requests return 401 instead of HTML
redirects. The session endpoint is uncached and returns only user/ward IDs.

## Implementation

- [Login form](../../../app/login/login-form.tsx): steps, focus, and submission.
- [Code input](../../../app/login/login-code-input.tsx): slots and paste handling.
- [Server actions](../../../app/login/actions.ts): request and verification.
- [Auth constants](../../../lib/auth/constants.ts): login/session lifetimes.

Verify keyboard entry, single-character deletion, complete/partial paste,
single-request submission, and layout at narrow mobile widths in a browser.

- [Action architecture](actions.md): server guards, client mutation hook,
  session context, ownership rules, and lint enforcement for new mutations.
- [Session provider](../../../components/session-provider.tsx) owns recovery state;
  [dialog](../../../components/session-recovery-dialog.tsx) renders its controls.
- [Session endpoint](../../../app/api/auth/session/route.ts) checks the database
  user; [completion page](../../../app/auth/complete/page.tsx) tells users to return
  to their original tab.
- [Proxy](../../../proxy.ts) lets Server Action POSTs reach their own auth guards
  rather than redirecting, and avoids login loops for deleted users.
- [Auth regression tests](../../../lib/auth/action.test.mjs) cover expired sessions,
  changed users/wards, no writes on failure, and no automatic retries. Browser
  checks should include cross-tab login, nested editor dialogs, desktop/mobile
  layouts, explicit retry, and retained draft values.
