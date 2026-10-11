import { isAdminCtx, requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

/** CSV cells beginning with = + - @ are prefixed so spreadsheets can't execute them as formulas. */
const cell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const orders = await db.orders.all(5000);
  const head = ["Order ID", "Created", "Status", "Paid", "Customer", "Phone", "Email", "Items", "Subtotal", "Discount", "Shipping", "Total", "Refunded", "Address", "Payment ID", "Tracking note"];
  const rows = orders.map((o) => [
    o.id, o.createdAt, o.status, o.paid ? "yes" : "no", o.customer.name, o.customer.phone, o.customer.email,
    o.items.map((i) => `${i.qty}x ${i.name} (${i.color}/${i.size})`).join("; "),
    o.subtotal, o.discount, o.shipping, o.total, o.refundedTotal ?? 0,
    [o.address.line1, o.address.line2, o.address.city, o.address.state, o.address.pincode].filter(Boolean).join(", "),
    o.razorpayPaymentId ?? "", o.trackingNote ?? "",
  ]);
  await audit(ctx, "orders.export", undefined, { rows: rows.length });
  const csv = [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lekratos-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
