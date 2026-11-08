import { bustCache } from "@/lib/cache";
import { isAdminCtx, requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { OrderError, cancelUnpaid, rejectManualPayment, setFulfilment, verifyManualPayment } from "@/lib/orders";
import { orderAction, parseJson } from "@/lib/schemas";
import { rateLimit, tooMany } from "@/lib/security";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const rl = await rateLimit(`admin-order-action:${ctx.sid}`, 120, 600);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const { id } = await params;
  const p = await parseJson(req, orderAction);
  if ("res" in p) return p.res;
  const a = p.data;

  try {
    let order;
    switch (a.action) {
      case "fulfil":
        order = await setFulfilment(id, a.status, ctx.actor, a.trackingNote);
        await audit(ctx, "order.status", id, { status: a.status });
        break;
      case "cancel":
        order = await cancelUnpaid(id, ctx.actor);
        await audit(ctx, "order.cancel", id);
        break;
      case "verify_payment":
        order = await verifyManualPayment(id, ctx.actor, a.note);
        await audit(ctx, "payment.verify", id, { reference: order.paymentReference?.slice(-8) ?? null, status: order.status });
        break;
      case "reject_payment":
        order = await rejectManualPayment(id, ctx.actor, a.reason);
        await audit(ctx, "payment.reject", id, { reference: order.paymentReference?.slice(-8) ?? null, reason: a.reason });
        break;
      case "note": {
        const o = await db.orders.byId(id);
        if (!o) throw new OrderError("NOT_FOUND", "Order not found");
        order = await db.orders.save({ ...o, adminNote: a.adminNote });
        await audit(ctx, "order.note", id);
        break;
      }
    }
    bustCache("catalog");
    return Response.json(order);
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 422 });
    log.error("admin order action failed", e, { orderId: id, action: a.action });
    return Response.json({ error: "Action failed" }, { status: 500 });
  }
}
