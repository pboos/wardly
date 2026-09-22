import { NextResponse, type NextRequest } from "next/server";
import {
  verifyJwt,
  refreshTokenIfNeeded,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { buildLoginUrl, getPostLoginRedirect } from "@/lib/auth/redirect";
import { CLAIM_USER_ID } from "@/lib/auth/constants";
import { prisma } from "@/lib/prisma";

const PUBLIC_ROUTES = [
  "/login",
  "/login/verify",
  "/logout",
  "/setup",
  "/api/cron",
];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic =
    PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/")) ||
    path === "/api/auth/session";

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyJwt(token);

  // Actions perform their own database-backed authentication and return a typed
  // failure. Redirecting their POST here would discard the client's draft.
  const isAction = req.method === "POST" && req.headers.has("next-action");
  if (!isPublic && !session && !isAction) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const originalPathAndSearch = req.nextUrl.pathname + req.nextUrl.search;
    return NextResponse.redirect(
      new URL(buildLoginUrl(originalPathAndSearch), req.nextUrl),
    );
  }
  // Authenticated users visiting /login are sent to their redirect target, or /.
  if (isPublic && session && path === "/login") {
    // A deleted user can still have a signed JWT. Allow login instead of
    // bouncing between the protected destination and /login indefinitely.
    const user = await prisma.user.findUnique({
      where: { id: session[CLAIM_USER_ID] },
      select: { id: true },
    });
    if (!user) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
    const redirectTarget = getPostLoginRedirect(req.nextUrl.searchParams);
    return NextResponse.redirect(new URL(redirectTarget, req.nextUrl));
  }

  const response = NextResponse.next();
  // Sliding refresh: if the JWT is close to expiry, re-issue a fresh token and
  // set it on the response cookie. The proxy is the only place that can do
  // this on every navigation, since `cookies().set()` is not permitted during
  // Server Component rendering. The current request proceeds with the
  // (still-valid) old token; the next request carries the fresh cookie.
  if (session) {
    const fresh = await refreshTokenIfNeeded(session);
    if (fresh) {
      response.cookies.set(SESSION_COOKIE_NAME, fresh, sessionCookieOptions);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
