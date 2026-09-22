export type SessionIdentity = { userId: string; wardId: string };

export type AuthFailure = "unauthenticated" | "session_changed" | "forbidden";

export type SessionRecovery = {
  identity: SessionIdentity | null;
  onFailure: (failure: AuthFailure) => void;
};

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; authError: AuthFailure };

export function sameIdentity(
  expected: SessionIdentity | null,
  actual: SessionIdentity | null,
): boolean {
  return (
    !!expected &&
    !!actual &&
    expected.userId === actual.userId &&
    expected.wardId === actual.wardId
  );
}
