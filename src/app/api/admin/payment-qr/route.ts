import { isAdminCtx, requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { rateLimit, tooMany } from "@/lib/security";
import { savePaymentQrImage, UploadError } from "@/lib/storage";

export async function POST(req: Request) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const rl = await rateLimit(`admin-payment-qr:${ctx.sid}`, 20, 600);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const data = await req.formData().catch(() => null);
  const file = data?.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a QR-code image" }, { status: 422 });
  try {
    const url = await savePaymentQrImage(file);
    await audit(ctx, "payment.qr.upload");
    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error instanceof UploadError ? error.message : "Upload failed" }, { status: 422 });
  }
}
