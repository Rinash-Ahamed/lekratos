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
  if (order.status === "pending" && order.reservedUntil && order.reservedUntil < new Date().toISOString()) {
    await reconcileExpired(order);
    order = (await db.orders.byId(id)) ?? order;
  }
  return json({ order: publicOrderView(order) });
}
