import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const LEASE_MS = 5 * 60 * 1000;

export async function claimDelivery(
  wardId: string,
  userId: string,
  sundayDate: string,
  now: Date,
) {
  const key = { ward_id: wardId, user_id: userId, sunday_date: sundayDate };
  // The unique constraint resolves concurrent first inserts without a read/write race.
  await prisma.task_digest_delivery.upsert({
    where: { ward_id_user_id_sunday_date: key },
    create: key,
    update: {},
  });
  const claimToken = randomUUID();
  const result = await prisma.task_digest_delivery.updateMany({
    where: {
      ...key,
      OR: [
        {
          status: "pending",
          OR: [{ next_attempt_at: null }, { next_attempt_at: { lte: now } }],
        },
        { status: "sending", lease_expires_at: { lte: now } },
      ],
    },
    data: {
      status: "sending",
      claim_token: claimToken,
      lease_expires_at: new Date(now.getTime() + LEASE_MS),
      attempts: { increment: 1 },
      updated_at: now,
    },
  });
  if (!result.count) return null;
  return prisma.task_digest_delivery.findFirstOrThrow({
    where: { ...key, claim_token: claimToken },
  });
}

export async function finishDelivery(
  id: string,
  claimToken: string,
  now: Date,
) {
  await prisma.task_digest_delivery.updateMany({
    where: { id, status: "sending", claim_token: claimToken },
    data: {
      status: "sent",
      sent_at: now,
      claim_token: null,
      lease_expires_at: null,
      next_attempt_at: null,
      last_error: null,
      updated_at: now,
    },
  });
}

export async function renewDelivery(id: string, claimToken: string, now: Date) {
  await prisma.task_digest_delivery.updateMany({
    where: { id, status: "sending", claim_token: claimToken },
    data: {
      lease_expires_at: new Date(now.getTime() + LEASE_MS),
      updated_at: now,
    },
  });
}

export async function retryDelivery(
  id: string,
  claimToken: string,
  attempts: number,
  now: Date,
  error: string,
) {
  const delay = Math.min(15, 2 ** Math.min(attempts - 1, 4)) * 60000;
  await prisma.task_digest_delivery.updateMany({
    where: { id, status: "sending", claim_token: claimToken },
    data: {
      status: "pending",
      claim_token: null,
      lease_expires_at: null,
      next_attempt_at: new Date(now.getTime() + delay),
      last_error: error,
      updated_at: now,
    },
  });
}
