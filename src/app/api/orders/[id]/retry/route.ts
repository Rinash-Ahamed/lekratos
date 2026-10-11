import { json, publicGuard } from "@/lib/api";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { OrderError, openGatewayOrder, reopenForPayment, tokenMatches } from "@/lib/orders";
import { paymentSession } from "@/lib/payment-session";
import { RazorpayError } from "@/lib/razorpay";
import { z } from "zod";
import { parseJson } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Retry after a failed / interrupted / expired attempt: re-holds stock and returns a payable session. */
export async function POST(req: Request, { params }: Ctx) {
  const blocked = await publicGuard(req, "order-retry", 15, 600);
  if (blocked) return blocked;
  const { id } = await params;
  const p = await parseJson(req, z.object({ token: z.string().max(80) }));
  if ("res" in p) return p.res;

  const order = await db.orders.byId(id);
  if (!order || !tokenMatches(order, p.data.token)) return json({ error: "Order not found" }, 404);

  try {
    const { order: reopened, needsGatewayOrder } = await reopenForPayment(id);
    const ready = needsGatewayOrder ? await openGatewayOrder(reopened) : reopened;
    return json(paymentSession(ready));
  } catch (e) {
    if (e instanceof OrderError) return json({ error: e.message, code: e.code }, e.code === "OUT_OF_STOCK" ? 409 : 422);
    if (e instanceof RazorpayError) {
      log.error("retry gateway failed", e, { code: e.code });
      return json({ error: "We couldn't restart the payment. Please try again." }, 502);
    }
    log.error("retry failed", e);
    return json({ error: "Something went wrong" }, 500);
  }
}
