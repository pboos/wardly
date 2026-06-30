import { NextResponse, type NextRequest } from "next/server";
import { verifyJwt, refreshTokenIfNeeded, sessionCookieOptions } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_ROUTES = ["/login", "/login/verify", "/logout", "/setup", "/api/cron"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.some(
    (r) => path === r || path.startsWith(r + "/"),
  );

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyJwt(token);

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  // Authenticated users visiting /login are sent to /.
  if (isPublic && session && path === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
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
