"use server";

import { revalidateMemberViews } from "@/lib/members/revalidate";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

function validateIds(value: unknown, limit: number): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > limit ||
    value.some((id) => typeof id !== "string" || !id.trim() || id.length > 100)
  ) {
    throw new Error("Invalid selection.");
  }
  return [...new Set(value)];
}

export async function bulkUpdateMemberTags(
  memberIds: string[],
  tagIds: string[],
  operation: "add" | "remove",
) {
  const user = await getCurrentUser();
  const members = validateIds(memberIds, 2000);
  const tags = validateIds(tagIds, 50);
  if (operation !== "add" && operation !== "remove")
    throw new Error("Invalid operation.");

  await prisma.$transaction(
    async (tx) => {
      const memberCount = await tx.member.count({
        where: { id: { in: members }, ward_id: user.ward_id },
      });
      const tagCount = await tx.member_tag.count({
        where: { id: { in: tags }, ward_id: user.ward_id },
      });
      if (memberCount !== members.length || tagCount !== tags.length) {
        throw new Error(
          "Some members or tags are unavailable. Reload the list.",
        );
      }
      // Bound SQL parameter counts while keeping every batch in one transaction.
      for (let offset = 0; offset < members.length; offset += 100) {
        const batch = members.slice(offset, offset + 100);
        const where = { member_id: { in: batch }, tag_id: { in: tags } };
        if (operation === "remove") {
          await tx.member_tag_assignment.deleteMany({ where });
        } else {
          const existing = await tx.member_tag_assignment.findMany({
            where,
            select: { member_id: true, tag_id: true },
          });
          const assigned = new Set(
            existing.map((row) => JSON.stringify([row.member_id, row.tag_id])),
          );
          const missing = batch.flatMap((member_id) =>
            tags
              .filter(
                (tag_id) => !assigned.has(JSON.stringify([member_id, tag_id])),
              )
              .map((tag_id) => ({ member_id, tag_id })),
          );
          for (let index = 0; index < missing.length; index += 100) {
            await tx.member_tag_assignment.createMany({
              data: missing.slice(index, index + 100),
            });
          }
        }
      }
    },
    { timeout: 30_000 },
  );
  revalidateMemberViews();
}
