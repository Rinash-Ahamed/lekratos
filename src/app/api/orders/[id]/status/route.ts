import { json, publicGuard } from "@/lib/api";
import { db } from "@/lib/db";
import { publicOrderView, reconcileExpired, tokenMatches } from "@/lib/orders";

type Ctx = { params: Promise<{ id: string }> };

/** Customer-facing order state. Requires the order access token issued at checkout. */
export async function GET(req: Request, { params }: Ctx) {
  const blocked = await publicGuard(req, "order-status", 120, 600);
  if (blocked) return blocked;
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("t");
  let order = await db.orders.byId(id);
  if (!order || !tokenMatches(order, token)) return json({ error: "Order not found" }, 404);

  // if the hold has lapsed, settle it now (paid → paid, otherwise release stock)
  if (["pending", "payment_pending"].includes(order.status) && order.reservedUntil && order.reservedUntil < new Date().toISOString()) {
    await reconcileExpired(order);
    order = (await db.orders.byId(id)) ?? order;
  }
  const view = publicOrderView(order);
  const settings = await db.settings.get();
  const payment = ["pending", "expired"].includes(order.status) && settings.payment.qrImage && settings.payment.upiId
    ? {
        qrImage: settings.payment.qrImage,
        upiId: settings.payment.upiId,
        payeeName: settings.payment.payeeName,
        instructions: settings.payment.instructions,
        amount: order.total,
        lateSubmissionOnly: order.status === "expired",
        deepLink: `upi://pay?pa=${encodeURIComponent(settings.payment.upiId)}&pn=${encodeURIComponent(settings.payment.payeeName || "LE.KRATOS")}&am=${order.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`LE.KRATOS ${order.id}`)}`,
      }
    : undefined;
  return json({ order: { ...view, manualPayment: payment } });
}
