/**
 * Public service API for the Sunday meeting planner. The implementation is
 * split into meeting-level and item-level modules to stay within the
 * repository's file-size limits; the exported surface here is the contract
 * the app builds against.
 */
export * from "./meeting-service.ts";
export * from "./item-service.ts";
