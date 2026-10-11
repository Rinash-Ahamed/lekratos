import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getDb } from "./data";
import { env, isProd } from "./env";
import { randomToken, safeEqual, sha256 } from "./ids";
import { ADMIN_COOKIE, SESSION_TTL_MS, csrfFor, constEq, parseSessionToken, signSessionToken } from "./admin-session";
import { forbidden, ipHash, sameOrigin } from "./security";

export { ADMIN_COOKIE };

const scrypt = (pw: string, salt: Buffer, n: number, r: number, p: number, len: number) =>
  new Promise<Buffer>((res, rej) => crypto.scrypt(pw, salt, len, { N: n, r, p, maxmem: 128 * n * r * 2 }, (e, k) => (e ? rej(e) : res(k))));

/** Hash format:  scrypt:N:r:p:<saltB64>:<hashB64>   (generate with `npm run admin:hash`) */
export async function makePasswordHash(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const [N, r, p] = [16384, 8, 1];
  const h = await scrypt(pw, salt, N, r, p, 32);
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${h.toString("base64")}`;
}

export function adminConfigured(): boolean {
  const a = env.admin();
  if (!a.sessionSecret || a.sessionSecret.length < 32) return false;
  return !!a.passwordHash || (!isProd() && !!a.password);
}

export async function verifyPassword(input: string): Promise<boolean> {
  const a = env.admin();
  if (a.passwordHash) {
    const [scheme, N, r, p, salt, hash] = a.passwordHash.split(":");
    if (scheme !== "scrypt") return false;
    const got = await scrypt(input, Buffer.from(salt, "base64"), +N, +r, +p, 32);
    return safeEqual(got.toString("base64"), hash);
  }
  // plaintext is accepted in development only
  if (!isProd() && a.password) return safeEqual(sha256(input), sha256(a.password));
  return false;
}

export async function createSession(req: Request) {
  const secret = env.admin().sessionSecret!;
  const sid = randomToken(18);
  const exp = Date.now() + SESSION_TTL_MS;
  await getDb().set("adminSessions", sid, {
    sid,
    createdAt: new Date().toISOString(),
    exp,
    expiresAt: new Date(exp),
    ipHash: ipHash(req),
    ua: sha256(req.headers.get("user-agent") ?? "").slice(0, 16),
  });
  return { token: await signSessionToken(sid, exp, secret), csrf: await csrfFor(sid, secret), maxAge: SESSION_TTL_MS / 1000 };
}

export async function destroySession(sid: string) {
  await getDb().delete("adminSessions", sid);
}

export interface AdminCtx {
  sid: string;
  csrf: string;
  actor: string;
  ipHash: string;
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Call at the top of EVERY admin route handler (middleware is only the first gate).
 * Verifies: signed token → live DB session → (unsafe methods) same-origin + CSRF header.
 */
export async function requireAdmin(req: Request): Promise<AdminCtx | Response> {
  const secret = env.admin().sessionSecret;
  if (!adminConfigured() || !secret) return Response.json({ error: "Admin is not configured" }, { status: 503 });

  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const parsed = await parseSessionToken(token, secret);
  if (!parsed) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const row = await getDb().get<{ exp: number }>("adminSessions", parsed.sid);
  if (!row || row.exp < Date.now()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const csrf = await csrfFor(parsed.sid, secret);
  if (!SAFE.has(req.method)) {
    if (!sameOrigin(req)) return forbidden("Cross-site request blocked");
    if (!constEq(req.headers.get("x-csrf-token") ?? "", csrf)) return forbidden("Missing or invalid CSRF token");
  }
  return { sid: parsed.sid, csrf, actor: "admin", ipHash: ipHash(req) };
}

export const isAdminCtx = (x: AdminCtx | Response): x is AdminCtx => !(x instanceof Response);

/** For server components: is there a valid admin session? (no CSRF needed for reads) */
export async function hasAdminSession(): Promise<AdminCtx | null> {
  const secret = env.admin().sessionSecret;
  if (!secret || !adminConfigured()) return null;
  const parsed = await parseSessionToken((await cookies()).get(ADMIN_COOKIE)?.value, secret);
  if (!parsed) return null;
  const row = await getDb().get<{ exp: number }>("adminSessions", parsed.sid);
  if (!row || row.exp < Date.now()) return null;
  return { sid: parsed.sid, csrf: await csrfFor(parsed.sid, secret), actor: "admin", ipHash: "" };
}
