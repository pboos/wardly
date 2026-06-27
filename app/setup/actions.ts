"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function setupInitialWard(formData: FormData) {
  // Guard: if a ward already exists, refuse to create another
  const existing = await prisma.ward.count();
  if (existing > 0) {
    throw new Error("Setup has already been completed.");
  }

  const wardName = String(formData.get("wardName") ?? "").trim();
  const userName = String(formData.get("userName") ?? "").trim();
  const userEmail = String(formData.get("userEmail") ?? "").trim().toLowerCase();

  // Basic validation
  if (!wardName || !userName || !userEmail) {
    throw new Error("All fields are required.");
  }

  // Email format check (simple)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  // Create the ward + first user in a transaction
  await prisma.$transaction(async (tx) => {
    const ward = await tx.ward.create({
      data: { name: wardName },
    });

    await tx.user.create({
      data: {
        ward_id: ward.id,
        name: userName,
        email: userEmail,
      },
    });
  });

  redirect("/login");
}
