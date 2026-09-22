import "server-only";
import { getSessionUser } from "@/lib/auth/dal";
import {
  sameIdentity,
  type ActionResult,
  type SessionIdentity,
} from "./action-result";

/** Expected identity prevents stale tabs submitting drafts as a different account.
 * It is not authorization: ownership always comes from the verified session.
 */
export async function authenticatedAction<T>(
  expected: SessionIdentity | null,
  operation: (
    actor: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>,
  ) => Promise<T>,
): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, authError: "unauthenticated" };
  if (!sameIdentity(expected, { userId: user.id, wardId: user.ward_id })) {
    return { ok: false, authError: "session_changed" };
  }
  return { ok: true, data: await operation(user) };
}
