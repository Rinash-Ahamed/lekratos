import { getDb } from "@/lib/data";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { OrderError, checkPaymentWithGateway, markPaid, recordAttemptFailure, recordRefund } from "@/lib/orders";
import { sha256 } from "@/lib/ids";
import { verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay → server. Source of truth for payments that complete after the tab is closed.
 *  - HMAC of the RAW body is verified with RAZORPAY_WEBHOOK_SECRET
 *  - de-duplicated by x-razorpay-event-id (safe on retries); markPaid is itself idempotent
 *  - payment data is re-validated against the gateway API and our order (amount/currency/order id)
 *  - 2xx = processed or intentionally ignored; 5xx = Razorpay will retry
 * Subscribe to: payment.captured, order.paid, payment.failed, refund.processed
 */
interface Entity {
  id: string;
  order_id?: string | null;
  payment_id?: string;
  amount?: number;
  status?: string;
  error_description?: string | null;
}
interface Payload {
  event: string;
  payload?: { payment?: { entity: Entity }; order?: { entity: Entity }; refund?: { entity: Entity } };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) return new Response("invalid signature", { status: 400 });

  let evt: Payload;
  try {
    evt = JSON.parse(raw) as Payload;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const eventId = req.headers.get("x-razorpay-event-id") ?? sha256(raw);
  if (await getDb().get("webhookEvents", eventId)) return Response.json({ ok: true, duplicate: true });

  try {
    const pay = evt.payload?.payment?.entity;
    const refund = evt.payload?.refund?.entity;

    if ((evt.event === "payment.captured" || evt.event === "order.paid") && pay?.order_id) {
      const order = await db.orders.byRazorpayId(pay.order_id);
      if (!order) log.warn("webhook for unknown order", { event: evt.event });
      else {
        const check = await checkPaymentWithGateway(order, pay.id);
        if (check.state === "captured") await markPaid(order.id, check.payment);
      }
    } else if (evt.event === "payment.failed" && pay?.order_id) {
      const order = await db.orders.byRazorpayId(pay.order_id);
      if (order) await recordAttemptFailure(order.id, pay.error_description ?? undefined);
    } else if (evt.event === "refund.processed" && refund?.payment_id) {
      const order = await db.orders.byRazorpayPaymentId(refund.payment_id);
      if (order && refund.amount) await recordRefund(order.id, { id: refund.id, amount: Math.round(refund.amount / 100), by: "gateway", restock: false });
    }

    await getDb().set("webhookEvents", eventId, { at: new Date().toISOString(), event: evt.event, expiresAt: new Date(Date.now() + 30 * 864e5) });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof OrderError) {
      // permanent mismatch (amount, ownership…) – retrying can't fix it; surface via logs and ack
      log.error("webhook rejected", e, { event: evt.event });
      await getDb().set("webhookEvents", eventId, { at: new Date().toISOString(), event: evt.event, rejected: true, expiresAt: new Date(Date.now() + 30 * 864e5) });
      return Response.json({ ok: true, rejected: true });
    }
    log.error("webhook failed", e, { event: evt.event });
    return new Response("error", { status: 500 });
  }
}
