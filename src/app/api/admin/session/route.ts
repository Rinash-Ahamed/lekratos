import { isAdminCtx, requireAdmin } from "@/lib/admin-auth";

/** Returns the CSRF token for the current session (the client sends it back in X-CSRF-Token). */
export async function GET(req: Request) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  return Response.json({ csrf: ctx.csrf }, { headers: { "Cache-Control": "no-store" } });
}
