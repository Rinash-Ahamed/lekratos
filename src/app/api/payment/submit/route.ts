import { json, publicGuard } from "@/lib/api";
import { db } from "@/lib/db";
import { OrderError, submitManualPayment, tokenMatches } from "@/lib/orders";
import { manualPaymentBody } from "@/lib/schemas";
import { savePaymentScreenshot, UploadError } from "@/lib/storage";

export async function POST(req: Request) {
  const blocked = await publicGuard(req, "payment-submission", 10, 600);
  if (blocked) return blocked;
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Invalid submission" }, 400);
  const parsed = manualPaymentBody.safeParse({
    orderId: String(form.get("orderId") ?? ""),
    token: String(form.get("token") ?? ""),
    reference: String(form.get("reference") ?? ""),
  });
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid payment details" }, 422);
  const order = await db.orders.byId(parsed.data.orderId);
  if (!order || !tokenMatches(order, parsed.data.token)) return json({ error: "Order not found" }, 404);
  const proof = form.get("screenshot");
  try {
    const screenshotKey = proof instanceof File && proof.size ? await savePaymentScreenshot(proof) : undefined;
    const saved = await submitManualPayment(order.id, parsed.data.reference, screenshotKey);
    return json({ orderId: saved.id, status: saved.status });
  } catch (error) {
    if (error instanceof UploadError) return json({ error: error.message }, 422);
    if (error instanceof OrderError) return json({ error: error.message }, error.code === "NOT_FOUND" ? 404 : 409);
    return json({ error: "Payment details could not be submitted" }, 500);
  }
}
