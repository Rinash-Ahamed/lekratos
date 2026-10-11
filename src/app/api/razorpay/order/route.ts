import { json, publicGuard } from "@/lib/api";
import { log } from "@/lib/log";
import { OrderError, createPendingOrder, openGatewayOrder, sweepExpired } from "@/lib/orders";
import { paymentSession } from "@/lib/payment-session";
import { priceCart } from "@/lib/pricing";
import { razorpayConfigured, RazorpayError } from "@/lib/razorpay";
import { checkoutBody, parseJson } from "@/lib/schemas";

/**
 * Step 1 of checkout. Prices the bag on the server, RESERVES stock in a transaction,
 * then creates the gateway order. The same checkoutKey always maps to the same order (idempotent).
 */
export async function POST(req: Request) {
  const blocked = await publicGuard(req, "checkout", 12, 600);
  if (blocked) return blocked;
  if (!razorpayConfigured()) return json({ error: "Online payments aren't available yet. Please try again later." }, 503);

  const p = await parseJson(req, checkoutBody);
  if ("res" in p) return p.res;
  const b = p.data;

  // opportunistic housekeeping so abandoned carts don't hold stock (a cron hits /api/cron/sweep too)
  if (Math.random() < 0.15) await sweepExpired().catch(() => undefined);

  const priced = await priceCart(b.lines as never, b.code);
  if (!priced.ok) return json({ error: priced.error, issues: priced.issues }, 422);

  try {
    const { order, token, reused } = await createPendingOrder({
      priced,
      customer: b.customer,
      address: { ...b.address },
      checkoutKey: b.checkoutKey,
    });
    const ready = reused && order.razorpayOrderId ? order : await openGatewayOrder(order);
    return json({ ...paymentSession(ready), token });
  } catch (e) {
    if (e instanceof OrderError) return json({ error: e.message, code: e.code }, e.code === "OUT_OF_STOCK" || e.code === "PRICE_CHANGED" ? 409 : 422);
    if (e instanceof RazorpayError) {
      log.error("gateway order failed", e, { code: e.code });
      return json({ error: "We couldn't start the payment. Nothing was charged — please try again." }, 502);
    }
    log.error("checkout failed", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
