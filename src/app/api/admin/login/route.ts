import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, adminConfigured, createSession, verifyPassword } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { isProd } from "@/lib/env";
import { forbidden, ipHash, rateLimit, sameOrigin, tooMany } from "@/lib/security";
import { parseJson } from "@/lib/schemas";

export async function POST(req: Request) {
  if (!adminConfigured())
    return NextResponse.json({ error: "Admin isn't configured. Set ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET (32+ chars)." }, { status: 503 });
  if (!sameOrigin(req)) return forbidden("Cross-site request blocked");

  // persistent, fail-closed brute-force protection (per IP and global)
  const ip = ipHash(req);
  const [a, g] = await Promise.all([
    rateLimit(`admin-login:${ip}`, 6, 15 * 60, { failClosed: true }),
    rateLimit("admin-login:global", 60, 60 * 60, { failClosed: true }),
  ]);
  if (!a.ok || !g.ok) return tooMany(Math.max(a.retryAfter, g.retryAfter));

  const p = await parseJson(req, z.object({ password: z.string().min(1).max(200) }));
  if ("res" in p) return p.res;

  if (!(await verifyPassword(p.data.password))) {
    await audit({ actor: "anonymous", ipHash: ip }, "login.failed");
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const s = await createSession(req);
  await audit({ actor: "admin", ipHash: ip }, "login.success");
  const res = NextResponse.json({ ok: true, csrf: s.csrf });
  res.cookies.set(ADMIN_COOKIE, s.token, { httpOnly: true, sameSite: "strict", secure: isProd(), path: "/", maxAge: s.maxAge });
  return res;
}
