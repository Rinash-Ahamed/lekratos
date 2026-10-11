"use client";

import { useEffect, useState } from "react";
import type { CartLine } from "./types";

export interface ServerPrice {
  ok: true;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode?: string;
  offerLabel?: string;
}
export interface ServerIssue { index: number; message: string; available: number }
export type PriceState =
  | { status: "idle" }
  | { status: "loading" }
  | ({ status: "ok" } & ServerPrice)
  | { status: "invalid"; error: string; issues: ServerIssue[] }
  | { status: "offline" };

/** Asks the server what this bag costs (prices, stock, discount and shipping are never computed in the browser). */
export function usePricing(cart: CartLine[], code?: string, enabled = true): PriceState {
  const [res, setRes] = useState<{ sig: string; state: PriceState } | null>(null);
  const sig = JSON.stringify([cart.map((l) => [l.productId, l.color, l.size, l.qty]), code ?? ""]);
  const active = enabled && cart.length > 0;

  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/checkout/price", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lines: cart.map(({ productId, color, size, qty }) => ({ productId, color, size, qty })), code: code || undefined }),
          signal: ctl.signal,
        });
        const j = await r.json();
        if (r.ok && j.ok) setRes({ sig, state: { status: "ok", ...j } });
        else setRes({ sig, state: { status: "invalid", error: j.error ?? "Please review your bag", issues: j.issues ?? [] } });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setRes({ sig, state: { status: "offline" } });
      }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sig` captures every input that matters
  }, [sig, active]);

  if (!active) return { status: "idle" };
  // a result for an older bag is never shown as current: while the new one is in flight we report "loading"
  return res && res.sig === sig ? res.state : { status: "loading" };
}
