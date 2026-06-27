"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateToken, generateCode, isExpired } from "@/lib/auth/tokens";
import { sendLoginEmail } from "@/lib/email";
import { createSession } from "@/lib/auth/session";
import { deleteExpiredLogins } from "@/lib/auth/cleanup";
import { MAX_LOGIN_ATTEMPTS } from "@/lib/auth/constants";

export type LoginState =
  | { status: "idle" }
  | { status: "email_sent"; email: string }
  | { status: "error"; message: string };

// Step 1: user submits their email.
export async function requestLogin(
  state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  await deleteExpiredLogins(); // lazy cleanup

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = generateToken();
    const code = generateCode();
    // upsert because login PK is user_id (one active login per user)
    await prisma.login.upsert({
      where: { user_id: user.id },
      create: { user_id: user.id, token, code },
      update: { token, code, attempts: 0, created_at: new Date() },
    });
    try {
      await sendLoginEmail({ to: user.email, name: user.name, token, code });
    } catch {
      // Log server-side; still tell the user "email sent" to avoid leaking.
    }
  }

  // Identical response whether or not the user exists.
  return { status: "email_sent", email };
}

// Step 2: user enters the code.
export async function verifyCode(
  state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!email || !code) {
    return { status: "error", message: "Please enter the code." };
  }

  await deleteExpiredLogins();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { status: "error", message: "Invalid or expired code." };

  const login = await prisma.login.findUnique({ where: { user_id: user.id } });
  if (!login) return { status: "error", message: "Invalid or expired code." };

  if (isExpired(login.created_at)) {
    await prisma.login.deleteMany({ where: { user_id: user.id } });
    return {
      status: "error",
      message: "The code has expired. Please request a new one.",
    };
  }

  if (login.code !== code) {
    await prisma.login.update({
      where: { user_id: user.id },
      data: { attempts: { increment: 1 } },
    });
    // If this was the MAX_LOGIN_ATTEMPTS-th attempt, wipe all login rows for this user.
    if (login.attempts + 1 >= MAX_LOGIN_ATTEMPTS) {
      await prisma.login.deleteMany({ where: { user_id: user.id } });
      return {
        status: "error",
        message: "Too many attempts. Please request a new code.",
      };
    }
    return { status: "error", message: "Incorrect code." };
  }

  // Success: delete the login row and issue a session.
  await prisma.login.delete({ where: { user_id: user.id } });
  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    ward_id: user.ward_id,
  });
  redirect("/");
}
