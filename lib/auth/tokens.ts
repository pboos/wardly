import { randomBytes } from "node:crypto";
import { LOGIN_TTL_MS } from "@/lib/auth/constants";

// Unambiguous alphabet: no 0, O, 1, I, L
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function isExpired(createdAt: Date, now = Date.now()): boolean {
  return now - createdAt.getTime() > LOGIN_TTL_MS;
}
