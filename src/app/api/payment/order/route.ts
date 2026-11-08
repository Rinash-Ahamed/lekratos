import { json, publicGuard } from "@/lib/api";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { createPendingOrder, OrderError, sweepExpired } from "@/lib/orders";
import { priceCart } from "@/lib/pricing";
import { checkoutBody, parseJson } from "@/lib/schemas";

export async function POST(req: Request) {
  const blocked = await publicGuard(req, "manual-checkout", 12, 600);
  if (blocked) return blocked;
  const parsed = await parseJson(req, checkoutBody);
  if ("res" in parsed) return parsed.res;
  const body = parsed.data;
  const settings = await db.settings.get();
  if (!settings.payment.upiId || !settings.payment.payeeName || !settings.payment.qrImage)
    return json({ error: "UPI payment is being configured. Please try again later." }, 503);

  if (Math.random() < 0.15) await sweepExpired().catch(() => undefined);
  const priced = await priceCart(body.lines as never, body.code);
  if (!priced.ok) return json({ error: priced.error, issues: priced.issues }, 422);

  try {
    const { order, token } = await createPendingOrder({
      priced,
      customer: body.customer,
      address: { ...body.address },
      checkoutKey: body.checkoutKey,
    });
    const upiUrl = `upi://pay?${new URLSearchParams({
      pa: settings.payment.upiId,
      pn: settings.payment.payeeName,
      am: order.total.toFixed(2),
      cu: "INR",
      tn: `LE.KRATOS ${order.id}`,
    }).toString()}`;
    return json({
      orderId: order.id,
      token,
      amount: order.total,
      reservedUntil: order.reservedUntil,
      qrImage: settings.payment.qrImage,
      upiId: settings.payment.upiId,
      payeeName: settings.payment.payeeName,
      instructions: settings.payment.instructions,
      upiUrl,
    });
  } catch (error) {
    if (error instanceof OrderError)
      return json({ error: error.message, code: error.code }, error.code === "OUT_OF_STOCK" || error.code === "PRICE_CHANGED" ? 409 : 422);
    log.error("manual checkout failed", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
