"use client";

import Image from "next/image";
import { useState } from "react";
import type { Banner, Collection, Offer } from "@/lib/types";
import { api, uploadImages } from "./api";
import { Field, Loading, useData, useToast } from "./ui";

function useList<T>(path: string) {
  const d = useData<T[]>(path);
  const [edited, setRows] = useState<T[] | null>(null);
  const reload = () => { setRows(null); d.reload(); };
  return { ...d, reload, rows: edited ?? d.data ?? [], setRows };
}

function Save({ path, rows, reload, label }: { path: string; rows: unknown; reload: () => void; label: string }) {
  const say = useToast();
  const [busy, setBusy] = useState(false);
  return <button className="btn btn-solid mt-4" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await api(path, "POST", rows); say(`${label} saved`); reload(); } catch (e) { say(e instanceof Error ? e.message : "Failed", "error"); }
    setBusy(false);
  }}>{busy ? "Saving…" : `Save ${label.toLowerCase()}`}</button>;
}

export default function ContentPanel() {
  return (
    <div className="space-y-16">
      <Banners /><Collections /><Offers />
    </div>
  );
}

function Banners() {
  const l = useList<Banner>("banners");
  const say = useToast();
  if (!l.data) return <Loading error={l.error} retry={l.reload} />;
  const set = (i: number, p: Partial<Banner>) => l.setRows(l.rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <section aria-labelledby="bn-h">
      <h2 id="bn-h" className="serif text-3xl">Home page banner</h2>
      <p className="mt-1 text-sm text-muted">The first active banner drives the hero headline, button and image.</p>
      <ul className="mt-5 space-y-5">
        {l.rows.map((b, i) => (
          <li key={b.id ?? i} className="grid gap-4 border hairline bg-surface p-4 md:grid-cols-2">
            <Field label="Headline"><input className="input" maxLength={80} value={b.headline} onChange={(e) => set(i, { headline: e.target.value })} /></Field>
            <Field label="Subtext"><input className="input" maxLength={160} value={b.sub} onChange={(e) => set(i, { sub: e.target.value })} /></Field>
            <Field label="Button text"><input className="input" maxLength={40} value={b.cta} onChange={(e) => set(i, { cta: e.target.value })} /></Field>
            <Field label="Button link (starts with /)"><input className="input" value={b.href} onChange={(e) => set(i, { href: e.target.value })} /></Field>
            <div className="flex flex-wrap items-center gap-4 md:col-span-2">
              {b.image && <Image src={b.image} alt="" width={64} height={80} unoptimized className="h-20 w-16 object-cover" />}
              <label className="btn btn-ghost cursor-pointer">Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={async (e) => {
                if (!e.target.files?.length) return;
                try { const [u] = await uploadImages(e.target.files); set(i, { image: u }); } catch (x) { say(x instanceof Error ? x.message : "Upload failed", "error"); }
                e.target.value = "";
              }} /></label>
              {b.image && <button className="eyebrow link-underline" onClick={() => set(i, { image: undefined })}>Remove image</button>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={b.active} onChange={(e) => set(i, { active: e.target.checked })} /> Active</label>
              <button className="eyebrow link-underline ml-auto text-accent-text" onClick={() => l.setRows(l.rows.filter((_, j) => j !== i))}>Remove banner</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="eyebrow link-underline mt-4 block" onClick={() => l.setRows([...l.rows, { id: "", headline: "", sub: "", cta: "Shop now", href: "/shop", active: true }])}>+ Add banner</button>
      <Save path="banners" rows={l.rows} reload={l.reload} label="Banners" />
    </section>
  );
}

function Collections() {
  const l = useList<Collection>("collections");
  if (!l.data) return <Loading error={l.error} retry={l.reload} />;
  const set = (i: number, p: Partial<Collection>) => l.setRows(l.rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <section aria-labelledby="co-h">
      <h2 id="co-h" className="serif text-3xl">Collections</h2>
      <ul className="mt-5 space-y-3">
        {l.rows.map((c, i) => (
          <li key={c.slug || i} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
            <Field label="Name"><input className="input" maxLength={60} value={c.name} onChange={(e) => set(i, { name: e.target.value })} /></Field>
            <Field label="Short description"><input className="input" maxLength={200} value={c.blurb} onChange={(e) => set(i, { blurb: e.target.value })} /></Field>
            <button className="eyebrow link-underline min-h-11 text-accent-text" onClick={() => l.setRows(l.rows.filter((_, j) => j !== i))}>Remove</button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Removing a collection doesn&apos;t delete its products; reassign them in the product editor.</p>
      <button className="eyebrow link-underline mt-3 block" onClick={() => l.setRows([...l.rows, { slug: "", name: "", blurb: "" }])}>+ Add collection</button>
      <Save path="collections" rows={l.rows} reload={l.reload} label="Collections" />
    </section>
  );
}

function Offers() {
  const l = useList<Offer>("offers");
  if (!l.data) return <Loading error={l.error} retry={l.reload} />;
  const set = (i: number, p: Partial<Offer>) => l.setRows(l.rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <section aria-labelledby="of-h">
      <h2 id="of-h" className="serif text-3xl">Promo codes</h2>
      <ul className="mt-5 space-y-3">
        {l.rows.map((o, i) => (
          <li key={o.id || i} className="grid gap-3 md:grid-cols-[1fr_2fr_6rem_8rem_auto_auto] md:items-end">
            <Field label="Code"><input className="input uppercase" maxLength={30} value={o.code} onChange={(e) => set(i, { code: e.target.value })} /></Field>
            <Field label="Label"><input className="input" maxLength={100} value={o.label} onChange={(e) => set(i, { label: e.target.value })} /></Field>
            <Field label="% off"><input className="input" type="number" min={1} max={90} value={o.percent} onChange={(e) => set(i, { percent: Number(e.target.value) })} /></Field>
            <Field label="Min. ₹"><input className="input" type="number" min={0} value={o.minSubtotal} onChange={(e) => set(i, { minSubtotal: Number(e.target.value) })} /></Field>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={o.active} onChange={(e) => set(i, { active: e.target.checked })} /> Active</label>
            <button className="eyebrow link-underline min-h-11 text-accent-text" onClick={() => l.setRows(l.rows.filter((_, j) => j !== i))}>Remove</button>
          </li>
        ))}
      </ul>
      <button className="eyebrow link-underline mt-3 block" onClick={() => l.setRows([...l.rows, { id: "", code: "", label: "", percent: 10, minSubtotal: 0, active: true }])}>+ Add code</button>
      <Save path="offers" rows={l.rows} reload={l.reload} label="Promo codes" />
    </section>
  );
}
