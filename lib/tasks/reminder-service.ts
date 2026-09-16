import { prisma } from "@/lib/prisma";
import { loadTaskTypes } from "./loader";
import { dueSunday } from "./reminder-schedule";
import {
  claimDelivery,
  finishDelivery,
  renewDelivery,
  retryDelivery,
} from "./reminder-delivery";
import type { TaskDigest } from "./reminder-email";

export async function sendDueTaskDigests(options: {
  send: (digest: TaskDigest) => Promise<void>;
  baseUrl: string;
  now?: () => Date;
}) {
  const clock = options.now ?? (() => new Date());
  const url = new URL("/tasks?filter=mine", options.baseUrl);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("APP_URL must use HTTP or HTTPS.");
  const stats = { sent: 0, failed: 0 };
  const wards = await prisma.ward.findMany({
    where: { sacrament_start_time: { not: null } },
  });
  for (const ward of wards) {
    const sundayDate = dueSunday(
      ward.time_zone,
      ward.sacrament_start_time,
      clock(),
    );
    if (!sundayDate) continue;
    const taskTypes = await loadTaskTypes(ward.id);
    const users = await prisma.user.findMany({
      where: {
        ward_id: ward.id,
        task: { some: { ward_id: ward.id, completed_at: null } },
      },
    });
    for (const user of users) {
      if (
        dueSunday(ward.time_zone, ward.sacrament_start_time, clock()) !==
        sundayDate
      )
        break;
      const claim = await claimDelivery(ward.id, user.id, sundayDate, clock());
      if (!claim) continue;
      const heartbeat = setInterval(() => {
        void renewDelivery(claim.id, claim.claim_token!, clock()).catch(() => {
          console.error("Task digest lease renewal failed", {
            deliveryId: claim.id,
          });
        });
      }, 60000);
      heartbeat.unref();
      try {
        // Read assignments after claiming so retries use current unfinished tasks.
        const tasks = await prisma.task.findMany({
          where: {
            ward_id: ward.id,
            assigned_user_id: user.id,
            completed_at: null,
          },
          include: {
            member: { select: { first_name: true, last_name: true } },
          },
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
        });
        if (
          !tasks.length ||
          dueSunday(ward.time_zone, ward.sacrament_start_time, clock()) !==
            sundayDate
        ) {
          await retryDelivery(
            claim.id,
            claim.claim_token!,
            claim.attempts,
            clock(),
            "No tasks or send window closed.",
          );
          continue;
        }
        await options.send({
          to: user.email,
          name: user.name,
          wardName: ward.name,
          sundayDate,
          meetingTime: ward.sacrament_start_time!,
          timeZone: ward.time_zone,
          tasksUrl: url.href,
          tasks: tasks.map((task) => {
            const type = taskTypes.find((type) => type.type === task.type);
            return {
              ...task,
              type: type?.name ?? task.type,
              state:
                type?.states.find((state) => state.state === task.state)
                  ?.label ?? task.state,
            };
          }),
        });
        await finishDelivery(claim.id, claim.claim_token!, clock());
        stats.sent++;
      } catch {
        // Do not persist SMTP responses: they can contain addresses or credentials.
        await retryDelivery(
          claim.id,
          claim.claim_token!,
          claim.attempts,
          clock(),
          "Task digest delivery failed.",
        );
        stats.failed++;
        console.error("Task digest delivery failed", { deliveryId: claim.id });
      } finally {
        clearInterval(heartbeat);
      }
    }
  }
  return stats;
}
