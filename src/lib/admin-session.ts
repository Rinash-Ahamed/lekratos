/**
 * Edge-safe (Web Crypto only) session token helpers, shared by middleware and Node route handlers.
 * Token = `${sid}.${expMs}.${hmac(sid.exp)}`  ·  CSRF token = hmac("csrf:" + sid)
 */
const enc = new TextEncoder();

export const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-lk_admin" : "lk_admin";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  let s = "";
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function constEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signSessionToken(sid: string, exp: number, secret: string) {
  return `${sid}.${exp}.${await hmac(secret, `${sid}.${exp}`)}`;
}

export async function parseSessionToken(token: string | undefined, secret: string | undefined): Promise<{ sid: string; exp: number } | null> {
  if (!token || !secret) return null;
  const [sid, expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!sid || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  return constEq(sig, await hmac(secret, `${sid}.${exp}`)) ? { sid, exp } : null;
}

export const csrfFor = (sid: string, secret: string) => hmac(secret, `csrf:${sid}`);
