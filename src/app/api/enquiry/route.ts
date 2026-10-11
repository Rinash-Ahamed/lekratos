import { json, publicGuard } from "@/lib/api";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { enquiryFields } from "@/lib/schemas";
import { UploadError, savePrivateAttachment } from "@/lib/storage";
import { SIZES, type Enquiry, type Size } from "@/lib/types";

export async function POST(req: Request) {
  const blocked = await publicGuard(req, "enquiry", 5, 3600);
  if (blocked) return blocked;

  const f = await req.formData().catch(() => null);
  if (!f) return json({ error: "Invalid request" }, 400);
  if (String(f.get("website") ?? "")) return json({ ok: true }); // honeypot

  const parsed = enquiryFields.safeParse(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Please check the form" }, 422);
  const d = parsed.data;

  const sizes: Partial<Record<Size, number>> = {};
  for (const s of SIZES) {
    const n = Math.floor(Number(f.get(`size_${s}`)));
    if (n > 0) sizes[s] = Math.min(n, 100000);
  }

  let attachmentKey: string | undefined;
  const file = f.get("reference");
  if (file instanceof File && file.size > 0) {
    try {
      attachmentKey = await savePrivateAttachment(file);
    } catch (e) {
      return json({ error: e instanceof UploadError ? e.message : "Upload failed" }, 422);
    }
  }

  const enquiry: Enquiry = {
    id: newId("ENQ"),
    name: d.name,
    phone: d.phone,
    email: d.email || undefined,
    product: d.product || "Not specified",
    quantity: d.quantity,
    sizes,
    location: d.location,
    notes: d.notes,
    attachmentKey,
    status: "new",
    createdAt: new Date().toISOString(),
  };
  await db.enquiries.save(enquiry);
  return json({ ok: true, id: enquiry.id });
}
