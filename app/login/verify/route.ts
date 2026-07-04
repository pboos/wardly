import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isExpired, sha256 } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";
import { deleteExpiredLogins } from "@/lib/auth/cleanup";
import { verifyRouteTarget } from "@/lib/auth/redirect";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? undefined;

  await deleteExpiredLogins();

  if (!token) return errorResponse("Invalid link.");

  const login = await prisma.login.findUnique({ where: { token_hash: sha256(token) } });
  if (!login)
    return errorResponse(
      "This link is invalid or has already been used.",
    );

  if (isExpired(login.created_at)) {
    await prisma.login.deleteMany({ where: { user_id: login.user_id } });
    return errorResponse(
      "This link has expired. Please request a new code.",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: login.user_id },
  });
  if (!user) return errorResponse("Invalid link.");

  const target = verifyRouteTarget(login);

  await prisma.login.delete({ where: { user_id: login.user_id } });
  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    ward_id: user.ward_id,
  });
  return NextResponse.redirect(new URL(target, req.url));
}

function errorResponse(message: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,sans-serif;line-height:1.5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1rem;background:#ffffff;color:#0c0a09">
    <div style="width:100%;max-width:24rem;display:flex;flex-direction:column;gap:1rem;padding:1.5rem;border:1px solid #e7e5e4;border-radius:0.5rem;background:#ffffff;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05)">
      <h1 style="font-size:1.5rem;font-weight:600;margin:0">Log in</h1>
      <p style="font-size:0.875rem;color:#dc2626;margin:0">${message}</p>
      <a href="/login" style="display:inline-flex;align-items:center;justify-content:center;height:2.25rem;border:1px solid #e7e5e4;border-radius:0.375rem;padding:0 0.75rem;font-size:0.875rem;font-weight:500;text-decoration:none;color:inherit">Back to login</a>
    </div>
  </body></html>`;
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
