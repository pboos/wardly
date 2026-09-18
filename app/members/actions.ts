"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { validateTag } from "./tags";

export async function saveTag(id: string | null, name: string, color: string) {
  const user = await getCurrentUser();
  if (id !== null && (typeof id !== "string" || !id))
    throw new Error("Invalid tag ID.");
  const data = validateTag(name, color);
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
  revalidatePath("/members");
}

export async function deleteTag(id: string) {
  if (typeof id !== "string" || !id) throw new Error("Invalid tag ID.");
  const user = await getCurrentUser();
  const result = await prisma.member_tag.deleteMany({
    where: { id, ward_id: user.ward_id },
  });
  if (result.count !== 1)
    throw new Error("Tag is unavailable. Reload the list.");
  revalidatePath("/members");
}

export async function setMemberTag(
  memberId: string,
  tagId: string,
  assigned: boolean,
) {
  const user = await getCurrentUser();
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
  revalidatePath("/members");
}
