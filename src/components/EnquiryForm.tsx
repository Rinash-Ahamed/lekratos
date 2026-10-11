"use client";

import { useState } from "react";
import { SIZES } from "@/lib/types";
import { useConfig } from "@/lib/config-context";

export function EnquiryForm({ products, defaultProduct }: { products: string[]; defaultProduct: string }) {
  const WA = useConfig().whatsapp ?? "";
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");

  const whatsapp = (form: HTMLFormElement) => {
    const f = new FormData(form);
    const sizes = SIZES.filter((s) => Number(f.get(`size_${s}`)) > 0)
      .map((s) => `${s}:${f.get(`size_${s}`)}`)
      .join(", ");
    const text = [
      "Hi le.kratos, I'd like to enquire about an order.",
      `Name: ${f.get("name") || "-"}`,
      `Product: ${f.get("product") || "-"}`,
      `Quantity: ${f.get("quantity") || "-"}`,
      `Sizes: ${sizes || "-"}`,
      `Delivery: ${f.get("location") || "-"}`,
      `Notes: ${f.get("notes") || "-"}`,
    ].join("\n");
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  if (state === "done")
    return (
      <div className="py-16" role="status">
        <p className="serif text-5xl">Received.</p>
        <p className="mt-4 max-w-md text-lg text-muted">Thanks — we&apos;ll get back to you with a quote.</p>
      </div>
    );

  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      encType="multipart/form-data"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        setErr("");
        try {
          const r = await fetch("/api/enquiry", { method: "POST", body: new FormData(e.currentTarget) });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? "Couldn't send");
          setState("done");
        } catch (ex) {
          setErr(ex instanceof Error ? ex.message : "Couldn't send");
          setState("idle");
        }
      }}
    >
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <L id="name" label="Name *"><input id="name" name="name" required className="input" autoComplete="name" /></L>
      <L id="phone" label="Contact number *"><input id="phone" name="phone" required type="tel" inputMode="tel" className="input" autoComplete="tel" /></L>
      <L id="email" label="Email (optional)"><input id="email" name="email" type="email" className="input" autoComplete="email" /></L>
      <L id="product" label="Product of interest">
        <input id="product" name="product" list="plist" defaultValue={defaultProduct} className="input" />
        <datalist id="plist">{products.map((p) => <option key={p} value={p} />)}</datalist>
      </L>
      <L id="quantity" label="Total quantity *"><input id="quantity" name="quantity" required type="number" min={1} inputMode="numeric" className="input" /></L>
      <L id="location" label="Delivery location *"><input id="location" name="location" required className="input" placeholder="City, state" /></L>

      <fieldset className="sm:col-span-2">
        <legend className="eyebrow mb-3 text-muted">Size breakdown</legend>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {SIZES.map((s) => (
            <div key={s}>
              <label htmlFor={`size_${s}`} className="eyebrow mb-1 block text-center">{s}</label>
              <input id={`size_${s}`} name={`size_${s}`} type="number" min={0} inputMode="numeric" className="input text-center" placeholder="0" />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <label htmlFor="reference" className="eyebrow mb-2 block text-muted">Reference image (optional — for discussion only)</label>
        <label htmlFor="reference" className="input flex cursor-pointer items-center justify-between">
          <span className={fileName ? "" : "text-muted"}>{fileName || "Choose a JPG, PNG or WebP"}</span>
          <span className="eyebrow">Browse</span>
        </label>
        <input id="reference" name="reference" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
      </div>

      <L id="notes" label="Anything else?" wide>
        <textarea id="notes" name="notes" rows={4} className="input" placeholder="Timelines, packaging, branding on tags…" />
      </L>

      <p role="alert" className="min-h-6 text-accent-text sm:col-span-2">{err}</p>
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button className="btn btn-solid" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send enquiry"}</button>
        {WA && (
          <button type="button" className="btn btn-ghost" onClick={(e) => whatsapp(e.currentTarget.form!)}>
            Enquire on WhatsApp
          </button>
        )}
      </div>
    </form>
  );
}

function L({ id, label, children, wide }: { id: string; label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="eyebrow mb-2 block text-muted">{label}</label>
      {children}
    </div>
  );
}
