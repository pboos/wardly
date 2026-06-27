import { NextResponse, type NextRequest } from "next/server";
import { verifyJwt } from "@/lib/auth/session";
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
