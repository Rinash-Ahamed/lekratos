import crypto from "crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I L O U)

/** Cryptographically random, human-friendly id, e.g. LK-7F3K9Q2XMD */
export function newId(prefix: string, len = 10): string {
  const bytes = crypto.randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % 32];
  return `${prefix}-${s}`;
}

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
