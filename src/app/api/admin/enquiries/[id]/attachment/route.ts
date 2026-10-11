import { isAdminCtx, requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { UploadError, readPrivateAttachment } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Private customer attachment — admin session required; cloud files are served via a 5-minute signed URL. */
export async function GET(req: Request, { params }: Ctx) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const { id } = await params;
  const e = await db.enquiries.byId(id);
  if (!e?.attachmentKey) return Response.json({ error: "No attachment" }, { status: 404 });
  try {
    const r = await readPrivateAttachment(e.attachmentKey);
    await audit(ctx, "enquiry.attachment.view", id);
    if ("url" in r) return Response.redirect(r.url, 302);
    return new Response(new Uint8Array(r.bytes), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
    });
  } catch (err) {
    return Response.json({ error: err instanceof UploadError ? err.message : "Attachment unavailable" }, { status: 404 });
  }
}
