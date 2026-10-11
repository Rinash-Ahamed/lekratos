import { json, publicGuard } from "@/lib/api";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { OrderError, checkPaymentWithGateway, markPaid, recordAttemptFailure, tokenMatches } from "@/lib/orders";
import { RazorpayError, verifyCheckoutSignature } from "@/lib/razorpay";
import { parseJson, verifyBody } from "@/lib/schemas";

/**
 * Called by the browser after the Razorpay modal succeeds. The browser is NOT trusted:
 *  1. order token proves the caller started this checkout
 *  2. HMAC signature proves the payment id belongs to our gateway order
 *  3. we ask Razorpay for the payment and check order id, amount, currency and "captured"
 * Only then is the order marked paid. If the gateway says "authorized"/pending, the webhook finalises it.
 */
export async function POST(req: Request) {
  const blocked = await publicGuard(req, "verify", 30, 600);
  if (blocked) return blocked;
  const p = await parseJson(req, verifyBody);
  if ("res" in p) return p.res;
  const b = p.data;

  const order = await db.orders.byId(b.orderId);
  if (!order || !tokenMatches(order, b.token) || order.razorpayOrderId !== b.razorpay_order_id)
    return json({ error: "Order not found" }, 404);
  if (!verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature))
    return json({ error: "Payment verification failed" }, 400);

  try {
    const check = await checkPaymentWithGateway(order, b.razorpay_payment_id);
    if (check.state === "captured") {
      const r = await markPaid(order.id, check.payment);
      return json({ status: r.outcome === "review" ? "review" : "paid", orderId: order.id });
    }
    if (check.state === "failed") {
      await recordAttemptFailure(order.id, check.reason);
      return json({ status: "failed", orderId: order.id });
    }
    return json({ status: "pending", orderId: order.id });
  } catch (e) {
    if (e instanceof OrderError) {
      log.error("payment validation rejected", e, { orderId: order.id });
      return json({ error: "We couldn't validate this payment. If money was deducted it will be reconciled automatically.", status: "pending" }, 409);
    }
    if (e instanceof RazorpayError) {
      // gateway unreachable: the signature was valid, so tell the client to wait; webhook/sweep will settle it
      log.warn("gateway unreachable during verify", { orderId: order.id, code: e.code });
      return json({ status: "pending", orderId: order.id });
    }
    log.error("verify failed", e, { orderId: order.id });
    return json({ error: "Something went wrong" }, 500);
  }
}
