"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useStore } from "@/lib/store";
import { inr } from "@/lib/format";

interface ManualPayment { qrImage: string; upiId: string; payeeName?: string; instructions?: string; amount: number; deepLink: string; lateSubmissionOnly?: boolean }
interface View {
  id: string; status: string; paid: boolean; paymentStatus?: string; paymentReference?: string; paymentRejectionReason?: string;
  total: number; subtotal: number; shipping: number; discount: number;
  items: { name: string; color: string; size: string; qty: number; price: number }[];
  trackingNote?: string; reservedUntil?: string; manualPayment?: ManualPayment;
}

const COPY: Record<string, { tag: string; title: string; body: string }> = {
  confirmed: { tag: "Payment verified", title: "Your order is confirmed.", body: "We verified your payment and allocated your pieces. The studio is preparing them now." },
  paid: { tag: "Payment verified", title: "Your order is confirmed.", body: "We verified your payment and will begin preparing your order shortly." },
  packed: { tag: "Packed", title: "Packed and ready.", body: "Your order has been packed and will ship soon." },
  shipped: { tag: "Shipped", title: "On its way.", body: "Your order has shipped." },
  delivered: { tag: "Delivered", title: "Delivered.", body: "Your order has been delivered. We hope you love it." },
  pending: { tag: "Payment required", title: "Complete your UPI payment.", body: "Pay the exact amount, then submit the UPI transaction reference below. Your order is confirmed only after our team verifies receipt." },
  payment_pending: { tag: "Verification pending", title: "We received your payment details.", body: "Our team is checking the transaction against the receiving account. A reference or screenshot is not proof of payment, so this order is not confirmed yet." },
  payment_rejected: { tag: "Verification unsuccessful", title: "We could not verify this payment.", body: "Review the reason below and contact support before making another payment." },
  expired: { tag: "Hold expired", title: "Your stock hold expired.", body: "The reserved pieces were released. If you already paid, contact support with your order ID; we will never silently confirm unavailable stock." },
  review: { tag: "Manual review", title: "Your order needs attention.", body: "The payment is being handled by our team, but stock needs a manual check before the order can be confirmed." },
  cancelled: { tag: "Cancelled", title: "Order cancelled.", body: "This order was cancelled. Contact support if you believe a payment was made." },
  refunded: { tag: "Refunded", title: "Order refunded.", body: "The refund has been recorded by our team." },
};

export function OrderStatus({ id, token }: { id: string; token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const { clear } = useStore();
  const tries = useRef(0);
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let stopped = false;
    fetch(`/api/orders/${encodeURIComponent(id)}/status?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        if (stopped) return;
        if (response.status === 404) setMissing(true);
        else if (response.ok) setView((await response.json()).order as View);
      })
      .catch(() => undefined);
    return () => { stopped = true; };
  }, [id, token, tick]);

  useEffect(() => {
    if (view?.status !== "payment_pending") return;
    const timer = setInterval(() => {
      if (++tries.current > 30) clearInterval(timer);
      else load();
    }, 4000);
    return () => clearInterval(timer);
  }, [view?.status, load]);

  useEffect(() => {
    if (view && (view.paid || view.status === "payment_pending" || view.status === "review")) clear();
  }, [view, clear]);

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const body = new FormData();
      body.set("orderId", id); body.set("token", token); body.set("reference", reference);
      if (screenshot) body.set("screenshot", screenshot);
      const response = await fetch("/api/payment/submit", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Could not submit payment details");
      tries.current = 0; load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  if (missing || !token) return (
    <div className="py-16 text-center">
      <h1 className="h-display text-5xl">We can&apos;t open that order</h1>
      <p className="lede mx-auto mt-4">The link may be incomplete. Look up the order with its ID and phone number.</p>
      <Link href="/track" className="btn btn-solid mt-8">Track an order</Link>
    </div>
  );
  if (!view) return <div className="skeleton mx-auto mt-8 h-64 max-w-3xl" aria-busy="true" aria-label="Loading order" />;

  const copy = COPY[view.status] ?? COPY.pending;
  const good = ["confirmed", "paid", "packed", "shipped", "delivered"].includes(view.status);
  return (
    <div className="mx-auto max-w-3xl">
      <p className={`eyebrow inline-block px-3 py-1.5 ${good ? "bg-accent text-accent-fg" : "bg-sunk"}`}>{copy.tag}</p>
      <div role="status" aria-live="polite">
        <h1 className="h-display mt-5 text-[clamp(2.4rem,7vw,4.5rem)]">{copy.title}</h1>
        <p className="lede mt-4">{copy.body}</p>
      </div>
      <p className="mt-4">Order ID <strong className="select-all">{view.id}</strong></p>
      {view.paymentReference && <p className="mt-2 text-sm text-muted">Submitted UPI reference: <strong>{view.paymentReference}</strong></p>}
      {view.paymentRejectionReason && <p className="payment-rejection mt-5" role="alert"><strong>Reason:</strong> {view.paymentRejectionReason}</p>}
      {view.trackingNote && <p className="mt-2 border-l-2 border-accent-text pl-3">{view.trackingNote}</p>}
      {message && <p role="alert" className="mt-4 text-accent-text">{message}</p>}

      {(view.status === "pending" || view.status === "expired") && view.manualPayment && (
        <form className="payment-resume mt-10" onSubmit={submitPayment}>
          {view.manualPayment.lateSubmissionOnly ? <div className="payment-warning"><strong>Only if you already paid</strong><p>Do not make a new payment after the stock hold has expired. Submit details here only for a payment you already completed; our team will verify it and check stock again.</p></div> : <div className="payment-resume-grid">
            <div className="payment-qr"><Image src={view.manualPayment.qrImage} alt={`UPI QR code for ${view.manualPayment.payeeName || "LE.KRATOS"}`} fill sizes="260px" /></div>
            <div>
              <p className="eyebrow">Pay exactly</p>
              <p className="payment-amount">{inr(view.manualPayment.amount)}</p>
              <p className="mt-3 text-sm"><strong>{view.manualPayment.payeeName || "LE.KRATOS"}</strong><br /><span className="select-all text-muted">{view.manualPayment.upiId}</span></p>
              {view.manualPayment.instructions && <p className="mt-4 text-sm text-muted">{view.manualPayment.instructions}</p>}
              <a href={view.manualPayment.deepLink} className="btn btn-ghost mt-5">Open UPI app</a>
            </div>
          </div>}
          <div className="payment-proof-fields">
            <label className="field"><span>UPI transaction / reference ID</span><input className="input" value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} minLength={6} maxLength={40} required autoComplete="off" /></label>
            <label className="field"><span>Payment screenshot <em>Optional</em></span><input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setScreenshot(event.target.files?.[0] ?? null)} /></label>
          </div>
          <p className="payment-warning">Submitting a reference or screenshot does not confirm payment. We verify every payment against the receiving account before confirming an order.</p>
          <button className="btn btn-solid" disabled={busy}>{busy ? "Submitting…" : "Submit for verification"}</button>
        </form>
      )}

      <section aria-label="Order summary" className="mt-12 border hairline bg-surface p-6">
        <ul className="divide-y divide-line">
          {view.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-4 py-3 text-sm"><span>{item.name} <span className="text-muted">· {item.color} · {item.size} · Qty {item.qty}</span></span><span>{inr(item.price * item.qty)}</span></li>
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
        {view.status === "payment_pending" && <button className="btn btn-ghost" onClick={load}>Check verification status</button>}
        <Link href={`/track?id=${encodeURIComponent(view.id)}`} className="btn btn-ghost">Track later</Link>
        <Link href="/shop" className="btn btn-ghost">Keep browsing</Link>
      </div>
    </div>
  );
}
