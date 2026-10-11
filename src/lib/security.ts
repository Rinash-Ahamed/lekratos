import "server-only";
import { getDb } from "./data";
import { env, isProd } from "./env";
import { sha256 } from "./ids";

/**
 * Client IP behind the platform proxy. Platform headers that clients cannot set win; otherwise we take the
 * Nth entry from the RIGHT of x-forwarded-for (TRUST_PROXY_HOPS, default 1), because the left-most entries
 * are client-controlled and spoofable. Hashed before it is ever stored.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const platform = h.get("x-vercel-forwarded-for") || h.get("cf-connecting-ip") || h.get("x-real-ip");
  if (platform) return platform.split(",")[0].trim();
  const hops = Math.max(1, Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "1", 10) || 1);
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return parts[parts.length - hops] || "unknown";
}
export const ipHash = (req: Request) => sha256(`ip:${clientIp(req)}`).slice(0, 24);

/**
 * Persistent fixed-window rate limiter backed by the database
 * (so limits hold across serverless instances and restarts).
 * Configure a Firestore TTL policy on `rateLimits.expiresAt` to auto-clean old windows.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
  opts: { failClosed?: boolean } = {},
): Promise<{ ok: boolean; retryAfter: number; remaining: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec * 1000;
  const id = `${sha256(key).slice(0, 32)}:${windowStart}`;
  const retryAfter = Math.max(1, Math.ceil((windowStart + windowSec * 1000 - now) / 1000));
  try {
    const count = await getDb().tx(async (tx) => {
      const cur = await tx.get<{ count: number }>("rateLimits", id);
      const next = (cur?.count ?? 0) + 1;
      tx.set("rateLimits", id, { count: next, key: sha256(key).slice(0, 12), windowStart, expiresAt: new Date(windowStart + windowSec * 2000) });
      return next;
    });
    return { ok: count <= limit, retryAfter, remaining: Math.max(0, limit - count) };
  } catch {
    // Limiter store unavailable: safety-critical callers (login) fail closed, everything else fails open.
    return { ok: !opts.failClosed, retryAfter, remaining: opts.failClosed ? 0 : limit };
  }
}

export function tooMany(retryAfter: number) {
  return Response.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** Rejects cross-site state-changing requests. Browsers always send Origin on cross-origin POST/PUT/PATCH/DELETE. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Non-browser clients (webhooks, curl, tests) send no Origin; browsers always do for unsafe methods.
    return !isProd() || req.headers.get("sec-fetch-site") !== "cross-site";
  }
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === host || o.origin === env.siteUrl();
  } catch {
    return false;
  }
}

export function forbidden(msg = "Forbidden") {
  return Response.json({ error: msg }, { status: 403 });
}
