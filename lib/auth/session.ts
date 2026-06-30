import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  CLAIM_USER_ID,
  CLAIM_EMAIL,
  CLAIM_NAME,
  CLAIM_WARD_ID,
  JWT_LIFETIME,
  JWT_REFRESH_THRESHOLD_MS,
  SESSION_COOKIE_MAX_AGE_S,
} from "@/lib/auth/constants";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export type SessionPayload = {
  sub: string; // user id
  [CLAIM_USER_ID]: string;
  [CLAIM_EMAIL]: string;
  [CLAIM_NAME]: string;
  [CLAIM_WARD_ID]: string;
  exp?: number;
};

export async function signJwt(p: Omit<SessionPayload, "exp">): Promise<string> {
  return new SignJWT({
    [CLAIM_USER_ID]: p[CLAIM_USER_ID],
    [CLAIM_EMAIL]: p[CLAIM_EMAIL],
    [CLAIM_NAME]: p[CLAIM_NAME],
    [CLAIM_WARD_ID]: p[CLAIM_WARD_ID],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(JWT_LIFETIME)
    .sign(secret);
}

export async function verifyJwt(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE_S,
};

export async function createSession(user: {
  id: string;
  email: string;
  name: string;
  ward_id: string;
}) {
  const token = await signJwt({
    sub: user.id,
    [CLAIM_USER_ID]: user.id,
    [CLAIM_EMAIL]: user.email,
    [CLAIM_NAME]: user.name,
    [CLAIM_WARD_ID]: user.ward_id,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Refresh if the token expires within the next hour. Returns a fresh JWT
// string when a refresh is needed, or `null` otherwise. This is a pure
// helper — it only signs a new token and never touches cookies, so it is
// safe to call from the proxy (which sets the response cookie) without
// running into the "cookies can only be modified in a Server Action or
// Route Handler" restriction that applies during Server Component render.
export async function refreshTokenIfNeeded(
  payload: SessionPayload,
): Promise<string | null> {
  if (!payload.exp) return null;
  const msLeft = payload.exp * 1000 - Date.now();
  if (msLeft > JWT_REFRESH_THRESHOLD_MS) return null;
  return signJwt({
    sub: payload.sub,
    [CLAIM_USER_ID]: payload[CLAIM_USER_ID],
    [CLAIM_EMAIL]: payload[CLAIM_EMAIL],
    [CLAIM_NAME]: payload[CLAIM_NAME],
    [CLAIM_WARD_ID]: payload[CLAIM_WARD_ID],
  });
}
