"use client";

import { useState } from "react";
import type { Size, StoreSettings } from "@/lib/types";
import { SIZES } from "@/lib/types";
import { api } from "./api";
import { Field, Loading, useData, useToast } from "./ui";

const num = (v: string) => (v === "" ? undefined : Number(v));

export default function SettingsPanel() {
  const d = useData<StoreSettings>("settings");
  const say = useToast();
  const [draft, setS] = useState<StoreSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const s = draft ?? d.data;
  if (!s) return <Loading error={d.error} retry={d.reload} />;

  const up = (p: Partial<StoreSettings>) => setS({ ...s, ...p });
  const ship = (p: Partial<StoreSettings["shipping"]>) => setS({ ...s, shipping: { ...s.shipping, ...p } });
  const chart = s.sizeChart;
  const save = async () => {
    setBusy(true);
    try { setS(await api<StoreSettings>("settings", "POST", s)); say("Settings saved"); }
    catch (e) { say(e instanceof Error ? e.message : "Couldn't save", "error"); }
    setBusy(false);
  };

  return (
    <div className="max-w-4xl space-y-14">
      <section aria-labelledby="s-b"><h2 id="s-b" className="serif text-3xl">Business</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Legal business name"><input className="input" value={s.legalName ?? ""} onChange={(e) => up({ legalName: e.target.value })} /></Field>
          <Field label="GSTIN (optional)"><input className="input" value={s.gstin ?? ""} onChange={(e) => up({ gstin: e.target.value })} /></Field>
          <Field label="Contact email"><input type="email" className="input" value={s.email ?? ""} onChange={(e) => up({ email: e.target.value })} /></Field>
          <Field label="Phone"><input type="tel" className="input" value={s.phone ?? ""} onChange={(e) => up({ phone: e.target.value })} /></Field>
          <Field label="WhatsApp number" hint="Digits only with country code, e.g. 919876543210. Enables the WhatsApp links."><input className="input" inputMode="numeric" value={s.whatsapp ?? ""} onChange={(e) => up({ whatsapp: e.target.value })} /></Field>
          <Field label="Instagram handle"><input className="input" value={s.instagram ?? ""} onChange={(e) => up({ instagram: e.target.value })} /></Field>
          <Field label="Business address" wide><textarea className="input" rows={3} value={s.address ?? ""} onChange={(e) => up({ address: e.target.value })} /></Field>
        </div></section>

      <section aria-labelledby="s-s"><h2 id="s-s" className="serif text-3xl">Shipping</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Flat shipping rate ₹" hint="0 means free shipping."><input className="input" type="number" min={0} value={s.shipping.flatRate ?? ""} onChange={(e) => ship({ flatRate: num(e.target.value) })} /></Field>
          <Field label="Free shipping above ₹ (optional)"><input className="input" type="number" min={0} value={s.shipping.freeAbove ?? ""} onChange={(e) => ship({ freeAbove: num(e.target.value) })} /></Field>
          <Field label="Dispatch time"><input className="input" placeholder="e.g. within 3 working days" value={s.shipping.dispatchTime ?? ""} onChange={(e) => ship({ dispatchTime: e.target.value })} /></Field>
          <Field label="Delivery time"><input className="input" placeholder="e.g. 4–7 working days" value={s.shipping.deliveryTime ?? ""} onChange={(e) => ship({ deliveryTime: e.target.value })} /></Field>
          <Field label="Where you deliver" wide><input className="input" value={s.shipping.coverage ?? ""} onChange={(e) => ship({ coverage: e.target.value })} /></Field>
        </div></section>

      <section aria-labelledby="s-bulk"><h2 id="s-bulk" className="serif text-3xl">Bulk orders</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Minimum quantity"><input className="input" type="number" min={0} value={s.bulk.minQuantity ?? ""} onChange={(e) => up({ bulk: { ...s.bulk, minQuantity: num(e.target.value) } })} /></Field>
          <Field label="Typical reply time"><input className="input" placeholder="e.g. within one working day" value={s.bulk.responseTime ?? ""} onChange={(e) => up({ bulk: { ...s.bulk, responseTime: e.target.value } })} /></Field>
        </div></section>

      <section aria-labelledby="s-p"><h2 id="s-p" className="serif text-3xl">Policies</h2>
        <p className="mt-1 text-sm text-muted">Public pages show a “draft” notice until you tick the box below. Have these reviewed before you rely on them.</p>
        <div className="mt-5 grid gap-4">
          <Field label="Returns & refund policy"><textarea className="input" rows={5} maxLength={4000} value={s.returnsPolicy ?? ""} onChange={(e) => up({ returnsPolicy: e.target.value })} /></Field>
          <Field label="Privacy policy (blank = built-in draft)"><textarea className="input" rows={5} maxLength={8000} value={s.privacyPolicy ?? ""} onChange={(e) => up({ privacyPolicy: e.target.value })} /></Field>
          <Field label="Terms of sale (blank = built-in draft)"><textarea className="input" rows={5} maxLength={8000} value={s.termsText ?? ""} onChange={(e) => up({ termsText: e.target.value })} /></Field>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={!!s.policiesReviewed} onChange={(e) => up({ policiesReviewed: e.target.checked })} /> I have reviewed these policies — remove the draft notice</label>
        </div></section>

      <section aria-labelledby="s-st"><h2 id="s-st" className="serif text-3xl">Brand story &amp; testimonials</h2>
        <div className="mt-5 grid gap-4">
          <Field label="Story heading"><input className="input" maxLength={120} value={s.brandStory?.heading ?? ""} onChange={(e) => up({ brandStory: { ...s.brandStory, heading: e.target.value } })} /></Field>
          <Field label="Story (blank paragraphs separate sections)"><textarea className="input" rows={6} maxLength={1500} value={s.brandStory?.body ?? ""} onChange={(e) => up({ brandStory: { ...s.brandStory, body: e.target.value } })} /></Field>
          <fieldset><legend className="eyebrow mb-2 text-muted">Customer testimonials — only real quotes you have permission to use</legend>
            <ul className="space-y-3">{(s.testimonials ?? []).map((t, i) => (
              <li key={i} className="grid gap-2 border hairline p-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
                <Field label="Quote"><input className="input" maxLength={400} value={t.quote} onChange={(e) => up({ testimonials: s.testimonials!.map((x, j) => (j === i ? { ...x, quote: e.target.value } : x)) })} /></Field>
                <Field label="Name"><input className="input" maxLength={60} value={t.name} onChange={(e) => up({ testimonials: s.testimonials!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></Field>
                <Field label="City"><input className="input" maxLength={60} value={t.place ?? ""} onChange={(e) => up({ testimonials: s.testimonials!.map((x, j) => (j === i ? { ...x, place: e.target.value } : x)) })} /></Field>
                <button className="eyebrow link-underline min-h-11 text-accent-text" onClick={() => up({ testimonials: s.testimonials!.filter((_, j) => j !== i) })}>Remove</button>
              </li>))}
            </ul>
            {(s.testimonials?.length ?? 0) < 6 && <button className="eyebrow link-underline mt-3" onClick={() => up({ testimonials: [...(s.testimonials ?? []), { quote: "", name: "" }] })}>+ Add testimonial</button>}
          </fieldset></div></section>

      <section aria-labelledby="s-sz"><h2 id="s-sz" className="serif text-3xl">Size chart</h2>
        {!chart ? (
          <button className="btn btn-ghost mt-4" onClick={() => up({ sizeChart: { unit: "in", columns: ["Chest", "Length"], rows: SIZES.map((size) => ({ size, values: ["", ""] })) } })}>Create size chart</button>
        ) : (
          <div className="mt-5 space-y-4">
            <Field label="Unit"><select className="input max-w-[10rem]" value={chart.unit} onChange={(e) => up({ sizeChart: { ...chart, unit: e.target.value as "in" | "cm" } })}><option value="in">Inches</option><option value="cm">Centimetres</option></select></Field>
            <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm">
              <thead><tr><th className="eyebrow py-2 text-left text-muted" scope="col">Size</th>{chart.columns.map((c, ci) => <th key={ci} scope="col" className="p-1"><input aria-label={`Column ${ci + 1} name`} className="input !py-2" value={c} onChange={(e) => up({ sizeChart: { ...chart, columns: chart.columns.map((x, k) => (k === ci ? e.target.value : x)) } })} /></th>)}</tr></thead>
              <tbody>{chart.rows.map((r, ri) => <tr key={r.size}><th scope="row" className="py-1 text-left">{r.size as Size}</th>{chart.columns.map((_, ci) => <td key={ci} className="p-1"><input aria-label={`${r.size} ${chart.columns[ci]}`} className="input !py-2" value={r.values[ci] ?? ""} onChange={(e) => up({ sizeChart: { ...chart, rows: chart.rows.map((x, k) => (k === ri ? { ...x, values: chart.columns.map((__, vi) => (vi === ci ? e.target.value : x.values[vi] ?? "")) } : x)) } })} /></td>)}</tr>)}</tbody>
            </table></div>
            <button className="eyebrow link-underline text-accent-text" onClick={() => up({ sizeChart: undefined })}>Remove size chart</button>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 -mx-4 border-t hairline bg-bg/95 px-4 py-4 backdrop-blur md:mx-0 md:px-0">
        <button className="btn btn-solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>
      </div>
    </div>
  );
}
