import { json, publicGuard } from "@/lib/api";
import { db } from "@/lib/db";
import { parseJson, trackBody } from "@/lib/schemas";
import { PAID_STATUSES } from "@/lib/types";

const digits = (s: string) => s.replace(/\D/g, "").slice(-10);

/** Order lookup by id + phone. Tight rate limit; identical error for "no order" and "wrong phone". */
export async function POST(req: Request) {
  const blocked = await publicGuard(req, "track", 10, 600);
  if (blocked) return blocked;
  const p = await parseJson(req, trackBody);
  if ("res" in p) return p.res;

  const order = await db.orders.byId(p.data.id.toUpperCase());
  const trackable = order && (PAID_STATUSES.includes(order.status) || order.status === "refunded" || order.status === "review");
  if (!order || !trackable || digits(order.customer.phone) !== digits(p.data.phone))
    return json({ error: "We couldn't match that order ID and phone number" }, 404);

  return json({
    order: {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      items: order.items,
      total: order.total,
      trackingNote: order.trackingNote,
      refundedTotal: order.refundedTotal,
    },
  });
}
