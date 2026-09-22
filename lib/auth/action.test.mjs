import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/auth/dal")
      return {
        shortCircuit: true,
        url: "data:text/javascript,export async function getSessionUser() { return globalThis.authTestUser; }",
      };
    return nextResolve(specifier, context);
  },
});

const { authenticatedAction } = await import("./action.ts");
const { executeAction, AuthActionError } =
  await import("../actions/execute-action.ts");
const identity = { userId: "user-a", wardId: "ward-a" };

test("authentication and identity checks run before an operation", async () => {
  let writes = 0;
  const operation = async (actor) => {
    assert.equal(actor.id, "user-a");
    assert.equal(actor.ward_id, "ward-a");
    return ++writes;
  };
  globalThis.authTestUser = null;
  assert.deepEqual(await authenticatedAction(identity, operation), {
    ok: false,
    authError: "unauthenticated",
  });
  globalThis.authTestUser = { id: "user-b", ward_id: "ward-a" };
  assert.deepEqual(await authenticatedAction(identity, operation), {
    ok: false,
    authError: "session_changed",
  });
  globalThis.authTestUser = { id: "user-a", ward_id: "ward-b" };
  assert.deepEqual(await authenticatedAction(identity, operation), {
    ok: false,
    authError: "session_changed",
  });
  globalThis.authTestUser = { id: "user-a", ward_id: "ward-a" };
  assert.equal(
    (await authenticatedAction(null, operation)).authError,
    "session_changed",
  );
  assert.equal(writes, 0);
  assert.deepEqual(await authenticatedAction(identity, operation), {
    ok: true,
    data: 1,
  });
  await assert.rejects(
    authenticatedAction(identity, async () => {
      throw new Error("domain failure");
    }),
    /domain failure/,
  );
});

test("client reports auth failures, rejects without retrying, and preserves success values", async () => {
  const failures = [];
  const session = {
    identity,
    onFailure: (reason) => failures.push(reason),
  };
  for (const reason of ["unauthenticated", "session_changed", "forbidden"]) {
    let requests = 0;
    const action = async (expected, value) => {
      assert.deepEqual(expected, identity);
      assert.equal(value, "draft");
      requests++;
      return { ok: false, authError: reason };
    };
    await assert.rejects(
      executeAction(action, session, "draft"),
      (error) => error instanceof AuthActionError && error.reason === reason,
    );
    assert.equal(requests, 1);
  }
  assert.deepEqual(failures, [
    "unauthenticated",
    "session_changed",
    "forbidden",
  ]);
  assert.deepEqual(
    await executeAction(
      async () => ({
        ok: true,
        data: { ok: false, error: "validation" },
      }),
      session,
    ),
    { ok: false, error: "validation" },
  );
  await assert.rejects(
    executeAction(async () => {
      throw new Error("offline");
    }, session),
    /offline/,
  );
  assert.equal(failures.length, 3, "network errors must not prompt login");
});

test("concurrent callers retain their own session identity and recovery handler", async () => {
  const failuresA = [];
  const failuresB = [];
  const otherIdentity = { userId: "user-b", wardId: "ward-b" };
  const calls = [];
  const action = async (expected) => {
    calls.push(expected);
    await Promise.resolve();
    return expected.userId === "user-a"
      ? { ok: false, authError: "unauthenticated" }
      : { ok: true, data: "saved" };
  };
  const results = await Promise.allSettled([
    executeAction(action, {
      identity,
      onFailure: (reason) => failuresA.push(reason),
    }),
    executeAction(action, {
      identity: otherIdentity,
      onFailure: (reason) => failuresB.push(reason),
    }),
  ]);
  assert.deepEqual(calls, [identity, otherIdentity]);
  assert.equal(results[0].status, "rejected");
  assert.deepEqual(results[1], { status: "fulfilled", value: "saved" });
  assert.deepEqual(failuresA, ["unauthenticated"]);
  assert.deepEqual(failuresB, []);
});
