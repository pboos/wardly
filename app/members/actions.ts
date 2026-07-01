"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export type MemberStatus =
  | "active"
  | "moved"
  | "unknown"
  | "unknown_address"
  | "no_contact"
  | "hidden";

const ALLOWED_TARGET_STATUSES: MemberStatus[] = [
  "active",
  "unknown",
  "unknown_address",
  "no_contact",
  "hidden",
];

export async function updateMemberStatus(
  memberId: string,
  status: MemberStatus,
): Promise<void> {
  if (!ALLOWED_TARGET_STATUSES.includes(status)) {
    throw new Error(`Status "${status}" cannot be set manually.`);
  }

  const user = await getCurrentUser();

  await prisma.member.updateMany({
    where: { id: memberId, ward_id: user.ward_id },
    data: { status, updated_at: new Date() },
  });

  revalidatePath("/members");
}
