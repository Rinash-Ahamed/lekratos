"use client";

import { useState } from "react";
import type { OrderStatus } from "@/lib/types";
import { dateLabel, inr } from "@/lib/format";

const STEPS: OrderStatus[] = ["paid", "packed", "shipped", "delivered"];
const LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Order confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  expired: "Expired",
  failed: "Payment failed",
  refunded: "Refunded",
  review: "Payment received — confirming stock",
};
interface TrackedOrder {
  id: string; status: OrderStatus; createdAt: string; total: number; trackingNote?: string; refundedTotal?: number;
  items: { name: string; color: string; size: string; qty: number }[];
}

export function TrackForm({ initialId }: { initialId: string }) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      <form
        className="mt-10 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setErr("");
          setOrder(null);
          try {
            const r = await fetch("/api/orders/track", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ id: f.get("id"), phone: f.get("phone") }),
            });
            const j = await r.json();
            if (!r.ok) setErr(j.error ?? "Couldn't find that order");
            else setOrder(j.order);
          } catch {
            setErr("Network error — try again");
          }
          setBusy(false);
        }}
      >
        <label className="sr-only" htmlFor="oid">Order ID</label>
        <input id="oid" name="id" required defaultValue={initialId} placeholder="Order ID" className="input" />
        <label className="sr-only" htmlFor="ph">Phone</label>
        <input id="ph" name="phone" required inputMode="tel" placeholder="Phone number" className="input" />
        <button className="btn btn-solid" disabled={busy}>{busy ? "Looking…" : "Track"}</button>
      </form>
      <p role="alert" className="mt-4 min-h-6 text-accent-text">{err}</p>

      {order && (
        <div className="mt-12">
          <p className="eyebrow text-muted">Order {order.id} · {dateLabel(order.createdAt)}</p>
          {["cancelled", "refunded", "review"].includes(order.status) ? (
            <p className="serif mt-4 text-4xl">{LABEL[order.status]}</p>
          ) : (
            <ol className="mt-6">
              {STEPS.map((s, i) => {
                const reached = STEPS.indexOf(order.status) >= i;
                return (
                  <li key={s} className="flex items-center gap-4 border-t hairline py-4">
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-sm ${reached ? "bg-accent text-accent-fg" : "border hairline text-muted"}`}>
                      {reached ? "✓" : i + 1}
                    </span>
                    <span className={reached ? "font-semibold" : "text-muted"}>{LABEL[s]}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {order.trackingNote && <p className="mt-6 border-l-2 border-accent-text pl-4">{order.trackingNote}</p>}
          <ul className="mt-8 space-y-1 text-sm text-muted">
            {order.items.map((it, i) => (
              <li key={i}>{it.qty} × {it.name} — {it.color}, {it.size}</li>
            ))}
          </ul>
          <p className="mt-4 text-lg font-semibold">Total {inr(order.total)}</p>
        </div>
      )}
    </>
  );
}
