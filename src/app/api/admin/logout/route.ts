import { NextResponse } from "next/server";
import { ADMIN_COOKIE, destroySession, isAdminCtx, requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  await destroySession(ctx.sid);
  await audit(ctx, "logout");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
