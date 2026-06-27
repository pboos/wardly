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
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_S,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Refresh if the token expires within the next hour. Called from the DAL on
// every authenticated request.
export async function maybeRefreshSession(
  payload: SessionPayload,
): Promise<SessionPayload> {
  if (!payload.exp) return payload;
  const msLeft = payload.exp * 1000 - Date.now();
  if (msLeft > JWT_REFRESH_THRESHOLD_MS) return payload;
  // Re-issue a fresh token
  await createSession({
    id: payload[CLAIM_USER_ID],
    email: payload[CLAIM_EMAIL],
    name: payload[CLAIM_NAME],
    ward_id: payload[CLAIM_WARD_ID],
  });
  return payload;
}
