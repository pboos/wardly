# Protected action architecture

Protected client mutations follow one path:

`component → useAppMutation → actions.ts → authenticatedAction → operation/service`

The client imports the Server Action directly. There are no per-feature client
or server forwarding modules. Login and initial setup are public actions with
their own validation and guards; they do not use session recovery.

## Responsibilities

- [Server guard](../../../lib/auth/action.ts) reads the current database user once,
  checks the tab's expected user/ward, and passes the verified actor to the callback.
  The expected identity is a stale-tab check, never an authorization source.
- Feature `actions.ts` modules declare `"use server"`, validate inputs inside the
  guard, invoke the operation/service, and revalidate affected routes on success.
  Resource permissions and ward-scoped queries remain with the operation. Existing
  Sunday services continue to own their transactions and domain rules.
- [Mutation hook](../../../lib/actions/use-app-mutation.ts) binds the action to
  the current React context and exposes `execute` and `isPending`. It counts
  concurrent invocations, clears pending state on failure, and never retries.
- [Execution helper](../../../lib/actions/execute-action.ts) unwraps the typed
  result, notifies session recovery for auth failures, and rejects into the
  caller's existing catch/finally path. It knows no dialog, global client state,
  browser events, or React components.
- [Session context](../../../lib/auth/session-context.ts) provides the narrow
  identity/recovery interface. The [provider](../../../components/session-provider.tsx)
  owns checking and recovery state; the [dialog](../../../components/session-recovery-dialog.tsx)
  only renders that state and user controls. Children remain mounted during recovery.

## Adding a mutation

```ts
// actions.ts — authenticated actor supplies ownership, never client input.
export async function save(identity: SessionIdentity | null, input: Input) {
  return authenticatedAction(identity, async (actor) => {
    const result = await service.save(actor, input);
    revalidatePath("/feature");
    return result;
  });
}
```

```tsx
import { save } from "./actions";
import { useAppMutation } from "@/lib/actions/use-app-mutation";

const { execute, isPending } = useAppMutation(save);
// In an event handler, with the feature's existing catch/finally handling:
await execute(input);
```

Keep input resets and success feedback after successful execution. Existing
feature validation results (such as `{ ok: false, error }`) remain unchanged and
must still be inspected. Auth failures are typed separately; network/unexpected
exceptions are not misclassified as expired sessions. Features can retain React
transitions that group several mutations and subsequent refreshes; `isPending`
tracks just the hook's requests. The hook does not suppress duplicate submissions.

The [ESLint rule](../../../lib/actions/eslint-plugin.mjs), enabled for app/component
TSX files except login/setup, permits protected action references only as arguments
to the imported `useAppMutation`. It detects direct calls, aliases, raw props, and
namespace imports. Runtime guards remain mandatory: lint is not a security boundary.

## Verification

`npm test` covers guard ordering, actor identity, failure propagation, no automatic
retries, persistence through the real action guards, and lint enforcement. Browser
checks cover expired sessions, nested forms, account switches, explicit retries,
and mobile layout. See [session recovery behavior](README.md#session-recovery).
