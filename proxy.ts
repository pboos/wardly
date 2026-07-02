import { NextResponse, type NextRequest } from "next/server";
import { verifyJwt, refreshTokenIfNeeded, sessionCookieOptions } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { buildLoginUrl, getPostLoginRedirect } from "@/lib/auth/redirect";

const PUBLIC_ROUTES = ["/login", "/login/verify", "/logout", "/setup", "/api/cron"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.some(
    (r) => path === r || path.startsWith(r + "/"),
  );

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyJwt(token);

  if (!isPublic && !session) {
    const originalPathAndSearch = req.nextUrl.pathname + req.nextUrl.search;
    return NextResponse.redirect(new URL(buildLoginUrl(originalPathAndSearch), req.nextUrl));
  }
  // Authenticated users visiting /login are sent to their redirect target, or /.
  if (isPublic && session && path === "/login") {
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
