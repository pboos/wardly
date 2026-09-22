"use server";

import { revalidateMemberViews } from "@/lib/members/revalidate";
import { authenticatedAction } from "@/lib/auth/action";
import type { SessionIdentity } from "@/lib/auth/action-result";
import { prisma } from "@/lib/prisma";
import { validateTag } from "./tags";

export async function saveTag(
  identity: SessionIdentity | null,
  id: string | null,
  name: string,
  color: string,
  isDefaultExcluded: boolean,
) {
  return authenticatedAction(identity, async (user) => {
    if (id !== null && (typeof id !== "string" || !id))
      throw new Error("Invalid tag ID.");
    if (typeof isDefaultExcluded !== "boolean")
      throw new Error("Invalid exclusion setting.");
    const data = {
      ...validateTag(name, color),
      is_default_excluded: isDefaultExcluded,
    };
    try {
      if (id === null) {
        await prisma.member_tag.create({
          data: { ...data, ward_id: user.ward_id },
        });
      } else {
        const result = await prisma.member_tag.updateMany({
          where: { id, ward_id: user.ward_id },
          data: { ...data, updated_at: new Date() },
        });
        if (result.count !== 1)
          throw new Error("Tag is unavailable. Reload the list.");
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new Error("A tag with that name already exists.");
      }
      throw error;
    }
    revalidateMemberViews();
  });
}

export async function deleteTag(identity: SessionIdentity | null, id: string) {
  return authenticatedAction(identity, async (user) => {
    if (typeof id !== "string" || !id) throw new Error("Invalid tag ID.");
    const result = await prisma.member_tag.deleteMany({
      where: { id, ward_id: user.ward_id },
    });
    if (result.count !== 1)
      throw new Error("Tag is unavailable. Reload the list.");
    revalidateMemberViews();
  });
}

export async function setMemberTag(
  identity: SessionIdentity | null,
  memberId: string,
  tagId: string,
  assigned: boolean,
) {
  return authenticatedAction(identity, async (user) => {
    if (
      typeof memberId !== "string" ||
      typeof tagId !== "string" ||
      typeof assigned !== "boolean"
    ) {
      throw new Error("Invalid tag assignment.");
    }
    await prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: { id: memberId, ward_id: user.ward_id },
      });
      const tag = await tx.member_tag.findFirst({
        where: { id: tagId, ward_id: user.ward_id },
      });
      if (!member || !tag)
        throw new Error("Member or tag is unavailable. Reload the list.");
      if (assigned) {
        await tx.member_tag_assignment.upsert({
          where: { member_id_tag_id: { member_id: memberId, tag_id: tagId } },
          create: { member_id: memberId, tag_id: tagId },
          update: {},
        });
      } else {
        await tx.member_tag_assignment.deleteMany({
          where: { member_id: memberId, tag_id: tagId },
        });
      }
    });
    revalidateMemberViews();
  });
}
