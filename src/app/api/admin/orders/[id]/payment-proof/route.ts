import { isAdminCtx, requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { readPrivateAttachment, UploadError } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const { id } = await params;
  const order = await db.orders.byId(id);
  if (!order?.paymentScreenshotKey) return Response.json({ error: "Payment screenshot not found" }, { status: 404 });
  try {
    const result = await readPrivateAttachment(order.paymentScreenshotKey);
    if ("url" in result) return Response.redirect(result.url);
    return new Response(new Uint8Array(result.bytes), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof UploadError ? error.message : "Could not read payment screenshot" }, { status: 404 });
  }
}
