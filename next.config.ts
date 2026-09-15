import type { NextConfig } from "next";

// Fail at startup/build if the development login is accidentally enabled.
// Keep config self-contained: the Docker runner does not copy application sources.
if (
  process.env.LOCAL_AUTH_BYPASS === "true" &&
  process.env.NODE_ENV !== "development"
) {
  throw new Error("LOCAL_AUTH_BYPASS is only allowed in development.");
}

const nextConfig: NextConfig = {};

export default nextConfig;
