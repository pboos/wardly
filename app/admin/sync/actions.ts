"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import {
  matchMembers,
  memberData,
  parseIncoming,
  type ResolvedPlan,
  type SyncDiff,
} from "./sync-model";
export type {
  IncomingMember,
  ExistingMember,
  FieldChanges,
  SyncDiff,
  ResolvedPlan,
} from "./sync-model";

export async function parseSync(
  rawText: string,
): Promise<SyncDiff | { error: string }> {
  const user = await getCurrentUser();
  let incoming;
  try {
    incoming = parseIncoming(rawText);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid member list.",
    };
  }
  const members = await prisma.member.findMany({
    where: { ward_id: user.ward_id },
  });
  return matchMembers(incoming, members);
}

export async function commitSync(
  plan: ResolvedPlan,
): Promise<{ added: number; moved: number; updated: number }> {
  const user = await getCurrentUser();
  if (
    !plan ||
    !Array.isArray(plan.inserts) ||
    !Array.isArray(plan.updates) ||
    !Array.isArray(plan.moves)
  )
    throw new Error("Invalid sync plan.");
  // Validate again at the server boundary, including uniqueness across all writes.
  const rows = [...plan.inserts, ...plan.updates];
  const normalized = rows.length ? parseIncoming(JSON.stringify(rows)) : [];
  const updateIds = plan.updates.map((row) => row.id);
  const ids = [...plan.moves, ...updateIds];
  if (
    ids.some((id) => typeof id !== "string" || !id) ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Invalid or duplicate member IDs in sync plan.");
  return prisma.$transaction(async (tx) => {
    let moved = 0;
    for (const incoming of normalized.slice(0, plan.inserts.length)) {
      await tx.member.create({
        data: {
          ...memberData(incoming),
          ward_id: user.ward_id,
          is_baptized: incoming.isBaptized ?? false,
          status: "active",
        },
      });
    }
    for (const id of plan.moves) {
      const result = await tx.member.updateMany({
        where: { id, ward_id: user.ward_id, external_uuid: { not: null } },
        data: { status: "moved", updated_at: new Date() },
      });
      if (result.count !== 1)
        throw new Error(
          "Member changed or is unavailable. Preview the sync again.",
        );
      moved += result.count;
    }
    for (const [index, update] of plan.updates.entries()) {
      const incoming = normalized[plan.inserts.length + index];
      const result = await tx.member.updateMany({
        where: {
          id: update.id,
          ward_id: user.ward_id,
          external_uuid: incoming.externalUuid,
        },
        data: {
          ...memberData(incoming),
          ...(update.reactivate === true ? { status: "active" } : {}),
          updated_at: new Date(),
        },
      });
      if (result.count !== 1)
        throw new Error(
          "Member identity changed or is unavailable. Preview the sync again.",
        );
    }
    return { added: plan.inserts.length, moved, updated: plan.updates.length };
  });
}
