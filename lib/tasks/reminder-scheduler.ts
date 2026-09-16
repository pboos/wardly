import "server-only";
import { sendTaskDigestEmail } from "@/lib/email";
import { sendDueTaskDigests } from "./reminder-service";

const schedulerGlobal = globalThis as typeof globalThis & {
  taskReminderSchedulerStarted?: boolean;
};

export function startTaskReminderScheduler() {
  if (schedulerGlobal.taskReminderSchedulerStarted) return;
  schedulerGlobal.taskReminderSchedulerStarted = true;

  async function tick() {
    try {
      if (
        !process.env.APP_URL ||
        !process.env.SMTP_HOST ||
        !process.env.SMTP_USER ||
        !process.env.SMTP_PASS
      ) {
        throw new Error(
          "Task reminders require APP_URL and SMTP configuration.",
        );
      }
      const stats = await sendDueTaskDigests({
        send: sendTaskDigestEmail,
        baseUrl: process.env.APP_URL,
      });
      if (stats.sent || stats.failed)
        console.info("Sunday task reminders", stats);
    } catch {
      console.error(
        "Sunday task reminder scheduler failed; check database, APP_URL and SMTP configuration.",
      );
    } finally {
      // Schedule after completion: slow sends never overlap within this process.
      setTimeout(tick, 60000).unref();
    }
  }
  setTimeout(tick, 0).unref();
}
