import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyJwt, maybeRefreshSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, CLAIM_USER_ID } from "@/lib/auth/constants";
import { prisma } from "@/lib/prisma";

export const verifySession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifyJwt(token);
  if (!payload) redirect("/login");
  await maybeRefreshSession(payload);
  return { isAuth: true, payload };
});

export const getCurrentUser = cache(async () => {
  const { payload } = await verifySession();
  const user = await prisma.user.findUnique({
    where: { id: payload[CLAIM_USER_ID] },
    select: { id: true, email: true, name: true, ward_id: true },
  });
  if (!user) redirect("/login");
  return user;
});
