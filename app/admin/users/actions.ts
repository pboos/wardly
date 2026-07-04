"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export type WardUser = {
  id: string;
  email: string;
  name: string;
  is_self: boolean;
};

export async function addUser(
  email: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  if (!normalizedEmail || !normalizedName) {
    return { ok: false, error: "Email and name are required." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "A user with that email already exists.",
    };
  }

  await prisma.user.create({
    data: {
      ward_id: user.ward_id,
      email: normalizedEmail,
      name: normalizedName,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function removeUser(
  userIdToRemove: string,
  reassignToUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();

  if (userIdToRemove === user.id) {
    return { ok: false, error: "You cannot remove yourself." };
  }

  if (userIdToRemove === reassignToUserId) {
    return {
      ok: false,
      error: "Select a different user to reassign tasks to.",
    };
  }

  const [target, reassignTo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userIdToRemove },
      select: { ward_id: true },
    }),
    prisma.user.findUnique({
      where: { id: reassignToUserId },
      select: { ward_id: true },
    }),
  ]);

  if (!target || target.ward_id !== user.ward_id) {
    return { ok: false, error: "User not found in your ward." };
  }
  if (!reassignTo || reassignTo.ward_id !== user.ward_id) {
    return {
      ok: false,
      error: "Reassign target not found in your ward.",
    };
  }

  await prisma.$transaction(async (tx) => {
    // Reassign everything owned by the removed user to the selected user.
    //
    // TODO: once the `task` table exists (see docs/DATABASE_SCHEMA.md §8),
    // reassign all of the removed user's tasks before deleting them. Example:
    //
    //   await tx.task.updateMany({
    //     where: {
    //       assigned_user_id: userIdToRemove,
    //       ward_id: user.ward_id,
    //     },
    //     data: {
    //       assigned_user_id: reassignToUserId,
    //       updated_at: new Date(),
    //     },
    //   });
    //
    // Add any future relations assigned to a user (e.g. agenda_item owners,
    // meeting organizers) here in the same transaction before the delete.

    await tx.user.delete({ where: { id: userIdToRemove } });
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
