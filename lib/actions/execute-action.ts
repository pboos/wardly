import type {
  ActionResult,
  AuthFailure,
  SessionIdentity,
  SessionRecovery,
} from "@/lib/auth/action-result";

export type AppAction<Args extends unknown[], T> = (
  identity: SessionIdentity | null,
  ...args: Args
) => Promise<ActionResult<T>>;

export class AuthActionError extends Error {
  readonly reason: AuthFailure;
  constructor(reason: AuthFailure) {
    super(
      reason === "forbidden"
        ? "You do not have permission to perform this action."
        : reason === "session_changed"
          ? "Your account or ward changed. Sign in with the original account to retry."
          : "Your session expired. Log in, then retry your change.",
    );
    this.reason = reason;
  }
}

/** One invocation, no retries. Rejection preserves the caller's catch/finally flow. */
export async function executeAction<Args extends unknown[], T>(
  action: AppAction<Args, T>,
  session: SessionRecovery,
  ...args: Args
): Promise<T> {
  const result = await action(session.identity, ...args);
  if (!result.ok) {
    session.onFailure(result.authError);
    throw new AuthActionError(result.authError);
  }
  return result.data;
}
