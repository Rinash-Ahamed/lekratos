"use client";

import { TOKENS } from "./theme";

export interface PaymentSession {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}
export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => {
      open: () => void;
      on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void;
    };
  }
}

let loading: Promise<void> | null = null;
/** Loads checkout.js on demand (it is allow-listed in the CSP). */
export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce || undefined;
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    if (nonce) s.nonce = nonce;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("Couldn't load the secure payment window. Check your connection and try again.")); };
    document.head.appendChild(s);
  });
  return loading;
}

export type PayResult =
  | { kind: "verified"; status: "paid" | "pending" | "failed" | "review" }
  | { kind: "dismissed" }
  | { kind: "failed"; message: string }
  | { kind: "verify-error"; message: string };

/** Opens the Razorpay modal and, on success, asks OUR server to verify (signature + gateway fetch). */
export async function pay(
  session: PaymentSession,
  token: string,
  opts: { prefill?: { name?: string; email?: string; contact?: string } },
): Promise<PayResult> {
  await loadRazorpay();
  return new Promise<PayResult>((resolve) => {
    let settled = false;
    const done = (r: PayResult) => { if (!settled) { settled = true; resolve(r); } };
    const rz = new window.Razorpay!({
      key: session.keyId,
      amount: session.amount,
      currency: session.currency,
      order_id: session.razorpayOrderId,
      name: "le.kratos",
      description: `Order ${session.orderId}`,
      prefill: opts.prefill,
      theme: { color: TOKENS.checkout },
      modal: { ondismiss: () => done({ kind: "dismissed" }) },
      handler: async (resp: RazorpayResponse) => {
        try {
          const r = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...resp, orderId: session.orderId, token }),
          });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.status) done({ kind: "verified", status: j.status });
          else if (j.status === "pending") done({ kind: "verified", status: "pending" });
          else done({ kind: "verify-error", message: j.error ?? "We couldn't confirm the payment yet." });
        } catch {
          // network dropped after payment: the webhook will still settle it
          done({ kind: "verified", status: "pending" });
        }
      },
    });
    rz.on("payment.failed", (r) => done({ kind: "failed", message: r.error?.description ?? "The payment didn't go through. You haven't been charged." }));
    rz.open();
  });
}
