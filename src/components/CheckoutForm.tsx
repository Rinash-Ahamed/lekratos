"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useConfig } from "@/lib/config-context";
import { inr } from "@/lib/format";
import { usePricing } from "@/lib/use-pricing";
import { pay, type PaymentSession } from "@/lib/razorpay-client";
import { ArtTee } from "./ArtTee";

const KEY_STORE = "lk:checkout-key";
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);

/** One idempotency key per (bag, code). Same bag + double click / refresh ⇒ same order. Changed bag ⇒ new key. */
function checkoutKey(sig: string, fresh = false): string {
  try {
    const cur = JSON.parse(sessionStorage.getItem(KEY_STORE) ?? "null") as { sig: string; key: string } | null;
    if (!fresh && cur && cur.sig === sig) return cur.key;
    const key = "ck-" + rid();
    sessionStorage.setItem(KEY_STORE, JSON.stringify({ sig, key }));
    return key;
  } catch {
    return "ck-" + rid();
  }
}

type Errs = Partial<Record<"name" | "phone" | "email" | "line1" | "city" | "state" | "pincode", string>>;
function validate(v: Record<string, string>): Errs {
  const e: Errs = {};
  if (v.name.trim().length < 2) e.name = "Enter your full name";
  if (!/^[+\d][\d\s-]{8,16}$/.test(v.phone.trim())) e.phone = "Enter a valid phone number";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email.trim())) e.email = "Enter a valid email";
  if (v.line1.trim().length < 3) e.line1 = "Enter your address";
  if (v.city.trim().length < 2) e.city = "Enter your city";
  if (v.state.trim().length < 2) e.state = "Enter your state";
  if (!/^\d{6}$/.test(v.pincode.trim())) e.pincode = "Enter a 6-digit pincode";
  return e;
}

export function CheckoutForm() {
  const { cart, clear, hydrated } = useStore();
  const cfg = useConfig();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [errs, setErrs] = useState<Errs>({});
  const form = useRef<HTMLFormElement>(null);
  const price = usePricing(cart, applied || undefined, hydrated);

  if (!hydrated) return <div className="min-h-[50vh]" aria-busy="true" aria-label="Loading checkout" />;
  if (cart.length === 0)
    return (
      <div className="py-16">
        <p className="serif text-3xl">Your bag is empty</p>
        <Link href="/shop" className="btn btn-solid mt-8">Shop the collection</Link>
      </div>
    );

  const lines = cart.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty }));
  const sig = JSON.stringify([lines, applied]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || price.status !== "ok") return;
    const f = new FormData(e.currentTarget);
    const v = Object.fromEntries(["name", "phone", "email", "line1", "line2", "city", "state", "pincode"].map((k) => [k, String(f.get(k) ?? "")]));
    const found = validate(v);
    setErrs(found);
    if (Object.keys(found).length) {
      setErr("Please fix the highlighted fields.");
      form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines, code: applied || undefined, checkoutKey: checkoutKey(sig),
          customer: { name: v.name, phone: v.phone, email: v.email },
          address: { line1: v.line1, line2: v.line2 || undefined, city: v.city, state: v.state, pincode: v.pincode },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status !== 429) checkoutKey(sig, true); // an ended/failed attempt needs a fresh key next time
        throw new Error(j.error ?? "Couldn't start the payment. Please try again.");
      }
      const session = j as PaymentSession & { token: string };
      const res = await pay(session, session.token, { prefill: { name: v.name, email: v.email, contact: v.phone } });
      if (res.kind === "dismissed") { setBusy(false); return; }
      if (res.kind === "failed") { setErr(res.message); setBusy(false); return; }
      // paid, pending, review and verify errors all end on the order page, which shows the true state and can retry
      if (res.kind === "verified" && res.status === "paid") clear();
      router.push(`/order/${encodeURIComponent(session.orderId)}?t=${encodeURIComponent(session.token)}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Something went wrong");
      setBusy(false);
    }
  };

  const field = (name: keyof Errs | "line2", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => {
    const msg = errs[name as keyof Errs];
    return (
      <div>
        <label htmlFor={name} className="eyebrow mb-2 block text-muted">{label}</label>
        <input id={name} name={name} {...props} className="input" aria-invalid={msg ? true : undefined} aria-describedby={msg ? `${name}-err` : undefined} />
        {msg && <p id={`${name}-err`} className="field-error">{msg}</p>}
      </div>
    );
  };

  const ok = price.status === "ok" ? price : null;
  const payable = !!ok && !busy;

  return (
    <form ref={form} onSubmit={submit} noValidate className="grid gap-14 md:grid-cols-12">
      <div className="space-y-12 md:col-span-7">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="serif mb-6 text-3xl">Contact</legend>
          {field("name", "Full name", { required: true, autoComplete: "name" })}
          {field("phone", "Phone", { required: true, type: "tel", autoComplete: "tel", inputMode: "tel" })}
          <div className="sm:col-span-2">{field("email", "Email", { required: true, type: "email", autoComplete: "email" })}</div>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="serif mb-6 text-3xl">Delivery address</legend>
          <div className="sm:col-span-2">{field("line1", "Address", { required: true, autoComplete: "address-line1" })}</div>
          <div className="sm:col-span-2">{field("line2", "Apartment, landmark (optional)", { autoComplete: "address-line2" })}</div>
          {field("city", "City", { required: true, autoComplete: "address-level2" })}
          {field("state", "State", { required: true, autoComplete: "address-level1" })}
          {field("pincode", "Pincode", { required: true, inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}
        </fieldset>
        <p className="text-sm text-muted">
          {cfg.flatRate || cfg.freeAbove ? "Shipping is calculated from your bag. " : ""}
          See <Link href="/shipping" className="link-underline text-fg">shipping</Link> and <Link href="/returns" className="link-underline text-fg">returns</Link> before you pay.
        </p>
      </div>

      <aside className="md:col-span-5">
        <div className="border hairline bg-surface p-6 md:sticky md:top-28">
          <h2 className="serif text-3xl">Order summary</h2>
          <ul className="mt-6 divide-y divide-line">
            {cart.map((l, i) => {
              const issue = price.status === "invalid" ? price.issues.find((x) => x.index === i) : undefined;
              return (
                <li key={`${l.productId}${l.color}${l.size}`} className="flex gap-4 py-4">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-sunk">
                    <ArtTee kind={l.art.kind} seed={l.art.seed} color={l.colorHex} label={l.name} className="h-full w-full" />
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold">{l.name}</p>
                    <p className="text-muted">{l.color} · {l.size} · Qty {l.qty}</p>
                    {issue && <p role="alert" className="mt-1 text-accent-text">{issue.message}</p>}
                  </div>
                  <p className="text-sm font-semibold">{inr(l.price * l.qty)}</p>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex gap-2">
            <label htmlFor="code" className="sr-only">Promo code</label>
            <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Promo code" className="input" autoComplete="off" />
            <button type="button" className="btn btn-ghost !px-5" onClick={() => setApplied(code.trim())}>Apply</button>
            {applied && <button type="button" className="eyebrow link-underline px-2" onClick={() => { setApplied(""); setCode(""); }}>Remove</button>}
          </div>
          <p role="status" className="mt-2 min-h-5 text-sm">
            {price.status === "invalid" ? <span className="text-accent-text">{price.error}</span> : ok?.offerLabel ? `✓ ${ok.offerLabel}` : ""}
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Subtotal" v={ok ? inr(ok.subtotal) : "—"} />
            {ok && ok.discount > 0 && <Row k="Discount" v={`− ${inr(ok.discount)}`} />}
            <Row k="Shipping" v={ok ? (ok.shipping ? inr(ok.shipping) : "Free") : "—"} />
            <div className="flex justify-between border-t hairline pt-3 text-lg font-semibold"><dt>Total</dt><dd>{ok ? inr(ok.total) : "—"}</dd></div>
          </dl>

          <button type="submit" className="btn btn-solid mt-6 w-full !py-5" disabled={!payable}>
            {busy ? "Opening secure payment…" : price.status === "loading" ? "Updating prices…" : `Pay ${ok ? inr(ok.total) : ""}`}
          </button>
          <p role="alert" className="mt-3 min-h-5 text-sm text-accent-text">{err}</p>
          {price.status === "offline" && <p className="text-sm text-muted">Can&apos;t reach the server to confirm prices. Check your connection.</p>}
          <p className="mt-2 text-center text-xs text-muted">UPI, cards, netbanking &amp; wallets via Razorpay. Your card details never touch our servers.</p>
        </div>
      </aside>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
  );
}
