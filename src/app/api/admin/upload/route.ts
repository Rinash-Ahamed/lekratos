import { isAdminCtx, requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { rateLimit, tooMany } from "@/lib/security";
import { UploadError, saveProductImage } from "@/lib/storage";

export async function POST(req: Request) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const rl = await rateLimit(`admin-upload:${ctx.sid}`, 60, 600);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const f = await req.formData().catch(() => null);
  const files = (f?.getAll("files") ?? []).filter((x): x is File => x instanceof File && x.size > 0);
  if (!files.length || files.length > 10) return Response.json({ error: "Choose 1–10 images" }, { status: 422 });
  try {
    const urls: string[] = [];
    for (const file of files) urls.push(await saveProductImage(file));
    await audit(ctx, "image.upload", undefined, { count: urls.length });
    return Response.json({ urls });
  } catch (e) {
    return Response.json({ error: e instanceof UploadError ? e.message : "Upload failed" }, { status: 422 });
  }
}
