export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.LOCAL_AUTH_BYPASS === "true" ||
    process.env.TASK_REMINDERS_ENABLED === "false" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.TASK_REMINDERS_ENABLED !== "true")
  )
    return;

  const { startTaskReminderScheduler } =
    await import("./lib/tasks/reminder-scheduler");
  startTaskReminderScheduler();
}
