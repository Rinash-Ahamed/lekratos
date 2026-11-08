"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useConfig } from "@/lib/config-context";
import { inr } from "@/lib/format";
import { usePricing } from "@/lib/use-pricing";
import { ArtTee } from "./ArtTee";

const KEY_STORE = "lk:checkout-key";
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
function checkoutKey(sig: string, fresh = false): string {
  try {
    const current = JSON.parse(sessionStorage.getItem(KEY_STORE) ?? "null") as { sig: string; key: string } | null;
    if (!fresh && current?.sig === sig) return current.key;
    const key = `ck-${rid()}`;
    sessionStorage.setItem(KEY_STORE, JSON.stringify({ sig, key }));
    return key;
  } catch { return `ck-${rid()}`; }
}

type Errs = Partial<Record<"name" | "phone" | "email" | "line1" | "city" | "state" | "pincode", string>>;
type ManualSession = {
  orderId: string; token: string; amount: number; reservedUntil?: string;
  qrImage: string; upiId: string; payeeName: string; instructions?: string; upiUrl: string;
};

function validate(values: Record<string, string>): Errs {
  const errors: Errs = {};
  if (values.name.trim().length < 2) errors.name = "Enter your full name";
  if (!/^[+\d][\d\s-]{8,16}$/.test(values.phone.trim())) errors.phone = "Enter a valid phone number";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(values.email.trim())) errors.email = "Enter a valid email";
  if (values.line1.trim().length < 3) errors.line1 = "Enter your address";
  if (values.city.trim().length < 2) errors.city = "Enter your city";
  if (values.state.trim().length < 2) errors.state = "Enter your state";
  if (!/^\d{6}$/.test(values.pincode.trim())) errors.pincode = "Enter a 6-digit pincode";
  return errors;
}

export function CheckoutForm() {
  const { cart, clear, hydrated } = useStore();
  const config = useConfig();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Errs>({});
  const [session, setSession] = useState<ManualSession | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const price = usePricing(cart, applied || undefined, hydrated);

  if (!hydrated) return <div className="min-h-[50vh]" aria-busy="true" aria-label="Loading checkout" />;
  if (cart.length === 0 && !session) return <div className="py-16"><p className="serif text-3xl">Your bag is empty</p><Link href="/shop" className="btn btn-solid mt-8">Shop the collection</Link></div>;

  const lines = cart.map((line) => ({ productId: line.productId, color: line.color, size: line.size, qty: line.qty }));
  const signature = JSON.stringify([lines, applied]);

  const startPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || price.status !== "ok") return;
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(["name", "phone", "email", "line1", "line2", "city", "state", "pincode"].map((key) => [key, String(data.get(key) ?? "")]));
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setError("Please fix the highlighted fields.");
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/payment/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines, code: applied || undefined, checkoutKey: checkoutKey(signature),
          customer: { name: values.name, phone: values.phone, email: values.email },
          address: { line1: values.line1, line2: values.line2 || undefined, city: values.city, state: values.state, pincode: values.pincode },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status !== 429) checkoutKey(signature, true);
        throw new Error(result.error ?? "Could not create the order");
      }
      setSession(result as ManualSession);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong"); }
    setBusy(false);
  };

  if (session) return <ManualPayment session={session} onComplete={() => clear()} />;

  const field = (name: keyof Errs | "line2", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => {
    const message = errors[name as keyof Errs];
    return <div><label htmlFor={name} className="eyebrow mb-2 block text-muted">{label}</label><input id={name} name={name} {...props} className="input" aria-invalid={message ? true : undefined} aria-describedby={message ? `${name}-err` : undefined} />{message && <p id={`${name}-err`} className="field-error">{message}</p>}</div>;
  };
  const priced = price.status === "ok" ? price : null;

  return (
    <form ref={formRef} onSubmit={startPayment} noValidate className="grid gap-14 md:grid-cols-12">
      <div className="space-y-12 md:col-span-7">
        <div className="checkout-step"><span>01</span><div><p>Delivery</p><small>Where your order is going</small></div></div>
        <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="serif mb-6 text-3xl">Contact</legend>
          {field("name", "Full name", { required: true, autoComplete: "name" })}
          {field("phone", "Phone", { required: true, type: "tel", autoComplete: "tel", inputMode: "tel" })}
          <div className="sm:col-span-2">{field("email", "Email", { required: true, type: "email", autoComplete: "email" })}</div>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="serif mb-6 text-3xl">Delivery address</legend>
          <div className="sm:col-span-2">{field("line1", "Address", { required: true, autoComplete: "address-line1" })}</div>
          <div className="sm:col-span-2">{field("line2", "Apartment, landmark (optional)", { autoComplete: "address-line2" })}</div>
          {field("city", "City", { required: true, autoComplete: "address-level2" })}
          {field("state", "State", { required: true, autoComplete: "address-level1" })}
          {field("pincode", "Pincode", { required: true, inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}
        </fieldset>
        <p className="text-sm text-muted">{config.flatRate || config.freeAbove ? "Shipping is calculated from your bag. " : ""}See <Link href="/shipping" className="link-underline text-fg">shipping</Link> and <Link href="/returns" className="link-underline text-fg">returns</Link> before placing your order.</p>
      </div>
      <aside className="md:col-span-5"><div className="checkout-summary md:sticky md:top-28">
        <p className="eyebrow text-muted">Your edit</p><h2 className="serif mt-2 text-3xl">Order summary</h2>
        <ul className="mt-6 divide-y divide-line">{cart.map((line, index) => {
          const issue = price.status === "invalid" ? price.issues.find((item) => item.index === index) : undefined;
          return <li key={`${line.productId}${line.color}${line.size}`} className="flex gap-4 py-4"><div className="relative h-20 w-16 shrink-0 overflow-hidden bg-sunk"><ArtTee kind={line.art.kind} seed={line.art.seed} color={line.colorHex} label={line.name} className="h-full w-full" /></div><div className="flex-1 text-sm"><p className="font-semibold">{line.name}</p><p className="text-muted">{line.color} · {line.size} · Qty {line.qty}</p>{issue && <p role="alert" className="mt-1 text-accent-text">{issue.message}</p>}</div><p className="text-sm font-semibold">{inr(line.price * line.qty)}</p></li>;
        })}</ul>
        <div className="mt-4 flex gap-2"><label htmlFor="code" className="sr-only">Promo code</label><input id="code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Promo code" className="input" autoComplete="off" /><button type="button" className="btn btn-ghost !px-5" onClick={() => setApplied(code.trim())}>Apply</button></div>
        <p role="status" className="mt-2 min-h-5 text-sm">{price.status === "invalid" ? <span className="text-accent-text">{price.error}</span> : priced?.offerLabel ? `✓ ${priced.offerLabel}` : ""}</p>
        <dl className="mt-4 space-y-2 text-sm"><Row k="Subtotal" v={priced ? inr(priced.subtotal) : "—"} />{priced && priced.discount > 0 && <Row k="Discount" v={`− ${inr(priced.discount)}`} />}<Row k="Shipping" v={priced ? (priced.shipping ? inr(priced.shipping) : "Free") : "—"} /><div className="flex justify-between border-t hairline pt-3 text-lg font-semibold"><dt>Total</dt><dd>{priced ? inr(priced.total) : "—"}</dd></div></dl>
        <button type="submit" className="btn btn-solid mt-6 w-full !py-5" disabled={!priced || busy}>{busy ? "Reserving your pieces…" : `Continue to UPI · ${priced ? inr(priced.total) : ""}`}</button>
        <p role="alert" className="mt-3 min-h-5 text-sm text-accent-text">{error}</p>
        <p className="mt-2 text-center text-xs text-muted">Your pieces are reserved temporarily. Payment is confirmed only after manual verification.</p>
      </div></aside>
    </form>
  );
}

function ManualPayment({ session, onComplete }: { session: ManualSession; onComplete: () => void }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const body = new FormData(); body.set("orderId", session.orderId); body.set("token", session.token); body.set("reference", reference); if (screenshot) body.set("screenshot", screenshot);
    try {
      const response = await fetch("/api/payment/submit", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Could not submit payment details");
      onComplete();
      router.push(`/order/${encodeURIComponent(session.orderId)}?t=${encodeURIComponent(session.token)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit payment details"); setBusy(false); }
  };
  return <div className="manual-payment-shell">
    <header><p className="experience-number">02 / Manual UPI payment</p><h2>Scan. Pay.<br /><i>Send the reference.</i></h2><p>Your order is reserved temporarily. We confirm it only after checking the payment in our UPI account.</p></header>
    <div className="payment-qr-card"><div className="payment-qr"><Image src={session.qrImage} alt={`UPI QR code for ${session.payeeName}`} fill sizes="320px" unoptimized /></div><p>Pay exactly</p><strong>{inr(session.amount)}</strong><dl><div><dt>UPI ID</dt><dd>{session.upiId}</dd></div><div><dt>Payee</dt><dd>{session.payeeName}</dd></div><div><dt>Order</dt><dd>{session.orderId}</dd></div></dl><a href={session.upiUrl} className="btn btn-solid w-full">Open UPI app</a></div>
    <form onSubmit={submit} className="payment-proof-form"><p className="eyebrow text-accent-text">After you pay</p><h3>Submit payment details</h3><ol><li><span>01</span>Scan the QR or open your UPI app.</li><li><span>02</span>Pay the exact amount shown.</li><li><span>03</span>Enter the UPI transaction/reference ID below.</li></ol>{session.instructions && <p className="payment-admin-note">{session.instructions}</p>}<label><span>UPI transaction/reference ID</span><input className="input" value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} minLength={6} maxLength={40} required autoComplete="off" placeholder="e.g. 431209876543" /></label><label className="payment-proof-upload"><span>Payment screenshot <small>Optional · JPG, PNG, WebP or AVIF</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setScreenshot(event.target.files?.[0] ?? null)} />{screenshot && <b>{screenshot.name}</b>}</label><div className="payment-warning"><strong>Verification required</strong><p>A transaction ID or screenshot is not proof of payment. Your order remains unconfirmed until our team verifies receipt.</p></div><button className="btn btn-solid w-full !py-5" disabled={busy}>{busy ? "Submitting…" : "Submit for verification"}</button><p role="alert" className="field-error min-h-5">{error}</p></form>
  </div>;
}

function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>; }
