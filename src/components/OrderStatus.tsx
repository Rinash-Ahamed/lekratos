"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { inr } from "@/lib/format";
import { pay, type PaymentSession } from "@/lib/razorpay-client";

interface View {
  id: string; status: string; paid: boolean; total: number; subtotal: number; shipping: number; discount: number;
  items: { name: string; color: string; size: string; qty: number; price: number }[];
  trackingNote?: string; retryable: boolean; reservedUntil?: string;
}

const COPY: Record<string, { tag: string; title: string; body: string }> = {
  paid: { tag: "Payment confirmed", title: "Thank you.", body: "Your order is confirmed. We'll start preparing it shortly." },
  packed: { tag: "Packed", title: "Packed and ready.", body: "Your order has been packed and will ship soon." },
  shipped: { tag: "Shipped", title: "On its way.", body: "Your order has shipped." },
  delivered: { tag: "Delivered", title: "Delivered.", body: "Your order has been delivered. We hope you love it." },
  pending: { tag: "Confirming", title: "Confirming your payment…", body: "We're waiting for the bank to confirm. If money left your account it will be matched to this order automatically — you don't need to pay again." },
  failed: { tag: "Not completed", title: "Payment didn't go through.", body: "You haven't been charged for this order. You can try again." },
  expired: { tag: "Hold expired", title: "Your hold expired.", body: "The items were released. You can try again if they're still available." },
  review: { tag: "Under review", title: "We have your payment.", body: "Your payment arrived but we need to confirm stock before shipping. We'll contact you shortly; if we can't fulfil it you'll be refunded in full." },
  cancelled: { tag: "Cancelled", title: "Order cancelled.", body: "This order was cancelled. Any payment will be refunded to the original method." },
  refunded: { tag: "Refunded", title: "Order refunded.", body: "This order has been refunded to the original payment method." },
};

export function OrderStatus({ id, token }: { id: string; token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { clear } = useStore();
  const tries = useRef(0);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let off = false;
    fetch(`/api/orders/${encodeURIComponent(id)}/status?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => { if (off) return; if (r.status === 404) setMissing(true); else if (r.ok) setView((await r.json()).order as View); })
      .catch(() => { /* offline: keep the last known state; the next poll retries */ });
    return () => { off = true; };
  }, [id, token, tick]);

  // poll while awaiting confirmation (stops after ~2 minutes; the webhook still settles it server-side)
  useEffect(() => {
    if (view?.status !== "pending") return;
    const t = setInterval(() => { if (++tries.current > 30) clearInterval(t); else load(); }, 4000);
    return () => clearInterval(t);
  }, [view?.status, load]);

  useEffect(() => { if (view && (view.paid || view.status === "review")) clear(); }, [view, clear]);

  const retry = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/orders/${encodeURIComponent(id)}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Couldn't restart the payment");
      const res = await pay(j as PaymentSession, token, {});
      if (res.kind === "failed" || res.kind === "verify-error") setMsg(res.message);
      tries.current = 0;
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Something went wrong"); }
    setBusy(false);
  };

  if (missing || !token)
    return (
      <div className="py-16 text-center">
        <h1 className="h-display text-5xl">We can&apos;t open that order</h1>
        <p className="lede mx-auto mt-4">The link may be incomplete. You can look your order up with its ID and phone number.</p>
        <Link href="/track" className="btn btn-solid mt-8">Track an order</Link>
      </div>
    );
  if (!view) return <div className="skeleton mx-auto mt-8 h-64 max-w-3xl" aria-busy="true" aria-label="Loading order" />;

  const c = COPY[view.status] ?? COPY.pending;
  const good = ["paid", "packed", "shipped", "delivered"].includes(view.status);
  return (
    <div className="mx-auto max-w-3xl">
      <p className={`eyebrow inline-block px-3 py-1.5 ${good ? "bg-accent text-accent-fg" : "bg-sunk"}`}>{c.tag}</p>
      <div role="status" aria-live="polite">
        <h1 className="h-display mt-5 text-[clamp(2.4rem,7vw,4.5rem)]">{c.title}</h1>
        <p className="lede mt-4">{c.body}</p>
      </div>
      <p className="mt-4">Order ID <strong className="select-all">{view.id}</strong></p>
      {view.trackingNote && <p className="mt-2 border-l-2 border-accent-text pl-3">{view.trackingNote}</p>}
      {msg && <p role="alert" className="mt-4 text-accent-text">{msg}</p>}

      {view.retryable && (
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="btn btn-solid" onClick={retry} disabled={busy}>{busy ? "Opening payment…" : view.status === "pending" ? "Pay now" : "Try payment again"}</button>
          {view.status === "pending" && <button className="btn btn-ghost" onClick={() => load()}>Check status</button>}
        </div>
      )}

      <section aria-label="Order summary" className="mt-12 border hairline bg-surface p-6">
        <ul className="divide-y divide-line">
          {view.items.map((i, k) => (
            <li key={k} className="flex justify-between gap-4 py-3 text-sm"><span>{i.name} <span className="text-muted">· {i.color} · {i.size} · Qty {i.qty}</span></span><span>{inr(i.price * i.qty)}</span></li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t hairline pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{inr(view.subtotal)}</dd></div>
          {view.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>− {inr(view.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{view.shipping ? inr(view.shipping) : "Free"}</dd></div>
          <div className="flex justify-between pt-2 text-lg font-semibold"><dt>Total</dt><dd>{inr(view.total)}</dd></div>
        </dl>
      </section>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/track?id=${encodeURIComponent(view.id)}`} className="btn btn-ghost">Track later</Link>
        <Link href="/shop" className="btn btn-ghost">Keep browsing</Link>
      </div>
    </div>
  );
}
