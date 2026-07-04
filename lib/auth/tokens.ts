import { randomBytes, createHash, timingSafeEqual, scrypt } from "node:crypto";
import { LOGIN_TTL_MS } from "@/lib/auth/constants";

const scryptAsync: (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer> = (password, salt, keylen) =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, (err, derived) =>
      err ? reject(err) : resolve(derived),
    ),
  );
const SCRYPT_KEYLEN = 32;

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

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function hashCode(code: string, salt: string): Promise<string> {
  return (await scryptAsync(code, salt, SCRYPT_KEYLEN)).toString("hex");
}

export async function verifyHashCode(
  stored: string,
  code: string,
  salt: string,
): Promise<boolean> {
  const computed = (await scryptAsync(code, salt, SCRYPT_KEYLEN)).toString("hex");
  const ab = Buffer.from(stored);
  const bb = Buffer.from(computed);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isExpired(createdAt: Date, now = Date.now()): boolean {
  return now - createdAt.getTime() > LOGIN_TTL_MS;
}
