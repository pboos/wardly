/** Server-side opt-in; never expose the environment flag as NEXT_PUBLIC_*. */
export function localAuthBypassEnabled(): boolean {
  const enabled = process.env.LOCAL_AUTH_BYPASS === "true";
  if (enabled && process.env.NODE_ENV !== "development") {
    throw new Error("LOCAL_AUTH_BYPASS is only allowed in development.");
  }
  return enabled;
}
