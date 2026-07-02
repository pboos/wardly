import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

// Clear the session cookie and redirect to /login. We build the response
// explicitly (rather than calling `cookies().delete()` + `redirect()`) so the
// Set-Cookie header is reliably attached to the redirect response — otherwise
// the cookie mutation can be dropped and the header stays visible until a
// full reload.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
