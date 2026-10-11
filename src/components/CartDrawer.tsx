"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { useConfig } from "@/lib/config-context";
import { inr, shippingFor } from "@/lib/format";
import { usePricing } from "@/lib/use-pricing";
import { ArtTee } from "./ArtTee";

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQty, remove } = useStore();
  const cfg = useConfig();
  const pathname = usePathname();
  const panel = useRef<HTMLElement>(null);
  const price = usePricing(cart, undefined, cartOpen);

  useEffect(() => setCartOpen(false), [pathname, setCartOpen]);

  useEffect(() => {
    if (!cartOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const f = () => [...(panel.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input") ?? [])];
    f()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCartOpen(false);
      if (e.key === "Tab") {
        const els = f(); if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; opener?.focus?.(); };
  }, [cartOpen, setCartOpen]);

  if (!cartOpen) return null;

  // Display estimate from the owner's settings until the server confirms; the server total is what is charged.
  const est = cart.reduce((n, l) => n + l.price * l.qty, 0);
  const subtotal = price.status === "ok" ? price.subtotal : est;
  const shipping = price.status === "ok" ? price.shipping : shippingFor(est, { flatRate: cfg.flatRate, freeAbove: cfg.freeAbove });
  const total = price.status === "ok" ? price.total : est + shipping;
  const toFree = cfg.freeAbove ? Math.max(0, cfg.freeAbove - subtotal) : 0;
  const issues = price.status === "invalid" ? price.issues : [];
  const blocked = price.status === "invalid" || price.status === "loading";

  return (
    <>
      <div className="fade-in fixed inset-0 z-[60] bg-black/50" onClick={() => setCartOpen(false)} aria-hidden />
      <aside ref={panel} role="dialog" aria-modal="true" aria-label="Shopping bag" className="sheet-in fixed inset-y-0 right-0 z-[61] flex w-full max-w-[460px] flex-col bg-bg text-fg shadow-2xl">
        <div className="flex items-center justify-between border-b hairline px-6 py-5">
          <h2 className="serif text-3xl">Your bag{cart.length ? ` (${cart.length})` : ""}</h2>
          <button onClick={() => setCartOpen(false)} className="eyebrow link-underline min-h-11 px-1">Close</button>
        </div>

        {cart.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <p className="serif text-4xl">Your bag is empty</p>
              <p className="mt-3 text-muted">Nothing here yet — the new arrivals are a good start.</p>
              <Link href="/shop" className="btn btn-solid mt-8">Shop the collection</Link>
            </div>
          </div>
        ) : (
          <>
            {cfg.freeAbove ? (
              <div className="px-6 pt-4 text-sm">
                <p>{toFree > 0 ? <>Add <strong>{inr(toFree)}</strong> more for free shipping</> : "You've unlocked free shipping."}</p>
                <div className="mt-2 h-1 bg-line" role="presentation"><div className="h-full origin-left bg-accent-text" style={{ width: `${Math.min(100, (subtotal / cfg.freeAbove) * 100)}%` }} /></div>
              </div>
            ) : null}
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
              {cart.map((l, i) => {
                const issue = issues.find((x) => x.index === i);
                return (
                  <li key={`${l.productId}-${l.color}-${l.size}`} className="flex gap-4 py-5">
                    <Link href={`/product/${l.slug}`} aria-label={l.name} className="relative block h-28 w-24 shrink-0 overflow-hidden bg-sunk">
                      {l.image ? <Image src={l.image} alt="" fill sizes="96px" className="object-cover" /> : <ArtTee kind={l.art.kind} seed={l.art.seed} color={l.colorHex} label={l.name} className="h-full w-full" />}
                    </Link>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <p className="serif text-lg leading-snug">{l.name}</p>
                        <p className="text-sm text-muted">{l.color} · {l.size}</p>
                        {issue && <p role="alert" className="mt-1 text-sm text-accent-text">{issue.message}</p>}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center border hairline">
                          <button aria-label={`Decrease quantity of ${l.name}`} className="h-10 w-10" onClick={() => (l.qty > 1 ? setQty(l, l.qty - 1) : remove(l))}>−</button>
                          <span className="w-8 text-center" aria-live="polite">{l.qty}</span>
                          <button aria-label={`Increase quantity of ${l.name}`} className="h-10 w-10" disabled={l.qty >= 10} onClick={() => setQty(l, l.qty + 1)}>+</button>
                        </div>
                        <span className="font-semibold">{inr(l.price * l.qty)}</span>
                      </div>
                    </div>
                    <button aria-label={`Remove ${l.name}`} className="h-8 w-8 self-start text-xl text-muted hover:text-fg" onClick={() => remove(l)}>×</button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t hairline p-6">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{inr(subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{shipping === 0 ? "Free" : inr(shipping)}</dd></div>
              </dl>
              {price.status === "invalid" && <p role="alert" className="mt-3 text-sm text-accent-text">{price.error}</p>}
              {price.status === "offline" && <p className="mt-3 text-sm text-muted">Couldn&apos;t refresh prices — the final amount is confirmed at checkout.</p>}
              <Link href="/checkout" aria-disabled={blocked} className={`btn btn-solid mt-5 w-full ${blocked ? "pointer-events-none opacity-50" : ""}`} tabIndex={blocked ? -1 : 0}>
                Checkout · {inr(total)}
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
