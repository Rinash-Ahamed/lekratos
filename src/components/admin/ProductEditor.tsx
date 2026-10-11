"use client";

import Image from "next/image";
import { useState } from "react";
import type { Collection, Product, Variant } from "@/lib/types";
import { SIZES } from "@/lib/types";
import { api, uploadImages } from "./api";

type Draft = Pick<Product, "name" | "collection" | "price" | "description" | "story" | "colors" | "variants" | "images" | "tags" | "published" | "fabric" | "fit" | "care" | "featured"> & {
  id?: string;
  compareAt?: number;
};

const TAGS = ["new", "bestseller", "limited", "trending"] as const;

export function ProductEditor({
  product,
  collections,
  onCancel,
  onSaved,
}: {
  product: Product | null;
  collections: Collection[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(
    product ?? {
      name: "", collection: collections[0]?.slug ?? "", price: 1799, description: "", story: "",
      colors: [{ name: "Black", hex: "#16161A" }], variants: [], images: [], tags: [], published: true,
    },
  );
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const stock = (color: string, size: string) => d.variants.find((v) => v.color === color && v.size === size)?.stock ?? 0;
  const setStock = (color: string, size: string, n: number) =>
    setD((x) => {
      const rest = x.variants.filter((v) => !(v.color === color && v.size === size));
      return { ...x, variants: [...rest, { color, size, stock: Math.max(0, n) } as Variant] };
    });

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("products", "POST", d);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
    }
    setBusy(false);
  };

  return (
    <div className="max-w-4xl">
      <button className="eyebrow link-underline mb-6 min-h-11" onClick={onCancel}>← Back to products</button>
      <h2 className="serif text-4xl">{product ? "Edit product" : "New product"}</h2>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <L t="Name"><input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></L>
        <L t="Collection">
          <select className="input" value={d.collection} onChange={(e) => setD({ ...d, collection: e.target.value })}>
            {collections.map((c) => <option key={c.slug} value={c.slug} className="text-black">{c.name}</option>)}
          </select>
        </L>
        <L t="Price (₹)"><input className="input" type="number" min={1} value={d.price} onChange={(e) => setD({ ...d, price: Number(e.target.value) })} /></L>
        <L t="Original price (₹, optional — shows a strike-through)">
          <input className="input" type="number" min={0} value={d.compareAt ?? ""} onChange={(e) => setD({ ...d, compareAt: e.target.value ? Number(e.target.value) : undefined })} />
        </L>
        <L t="The story behind this design" wide><textarea className="input" rows={3} value={d.story} onChange={(e) => setD({ ...d, story: e.target.value })} /></L>
        <L t="Product details" wide><textarea className="input" rows={3} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></L>
        <L t="Fabric (only what you can stand behind)"><input className="input" value={d.fabric ?? ""} onChange={(e) => setD({ ...d, fabric: e.target.value })} /></L>
        <L t="Fit"><input className="input" value={d.fit ?? ""} onChange={(e) => setD({ ...d, fit: e.target.value })} /></L>
        <L t="Care instructions" wide><input className="input" value={d.care ?? ""} onChange={(e) => setD({ ...d, care: e.target.value })} /></L>
      </div>

      <fieldset className="mt-8">
        <legend className="eyebrow mb-2 text-muted">Badges</legend>
        <div className="flex flex-wrap gap-4">
          {TAGS.map((t) => (
            <label key={t} className="flex items-center gap-2 capitalize">
              <input type="checkbox" className="h-4 w-4 accent-[var(--fg)]" checked={d.tags.includes(t)}
                onChange={(e) => setD({ ...d, tags: e.target.checked ? [...d.tags, t] : d.tags.filter((x) => x !== t) })} />
              {t}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--fg)]" checked={d.published} onChange={(e) => setD({ ...d, published: e.target.checked })} />
            Visible in store
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--fg)]" checked={!!d.featured} onChange={(e) => setD({ ...d, featured: e.target.checked })} />
            Featured on home page
          </label>
        </div>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="eyebrow mb-2 text-muted">Photos & designs (first image is the cover)</legend>
        <ul className="flex flex-wrap gap-3">
          {d.images.map((src, i) => (
            <li key={src} className="relative h-28 w-24"> 
              <Image src={src} alt="" width={96} height={112} unoptimized className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 px-1 text-xs text-white">
                <button aria-label="Move left" disabled={i === 0} onClick={() => setD({ ...d, images: swap(d.images, i, i - 1) })}>←</button>
                <button aria-label="Remove image" onClick={() => setD({ ...d, images: d.images.filter((_, j) => j !== i) })}>✕</button>
                <button aria-label="Move right" disabled={i === d.images.length - 1} onClick={() => setD({ ...d, images: swap(d.images, i, i + 1) })}>→</button>
              </div>
            </li>
          ))}
          <li>
            <label className="grid h-28 w-24 cursor-pointer place-items-center border border-dashed hairline text-center text-sm text-muted hover:border-fg">
              + Upload
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only"
                onChange={async (e) => {
                  if (!e.target.files?.length) return;
                  try { const urls = await uploadImages(e.target.files); setD((x) => ({ ...x, images: [...x.images, ...urls] })); }
                  catch (ex) { setErr(ex instanceof Error ? ex.message : "Upload failed"); }
                  e.target.value = "";
                }} />
            </label>
          </li>
        </ul>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="eyebrow mb-2 text-muted">Colours</legend>
        <ul className="space-y-2">
          {d.colors.map((c, i) => (
            <li key={i} className="flex items-center gap-3">
              <input aria-label="Colour swatch" type="color" value={c.hex} className="h-11 w-14 cursor-pointer border hairline bg-transparent"
                onChange={(e) => setD({ ...d, colors: d.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })} />
              <input aria-label="Colour name" className="input max-w-xs" value={c.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const old = c.name;
                  setD({
                    ...d,
                    colors: d.colors.map((x, j) => (j === i ? { ...x, name } : x)),
                    variants: d.variants.map((v) => (v.color === old ? { ...v, color: name } : v)),
                  });
                }} />
              {d.colors.length > 1 && (
                <button className="eyebrow link-underline text-accent-text"
                  onClick={() => setD({ ...d, colors: d.colors.filter((_, j) => j !== i), variants: d.variants.filter((v) => v.color !== c.name) })}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        <button className="eyebrow link-underline mt-3" onClick={() => setD({ ...d, colors: [...d.colors, { name: `Colour ${d.colors.length + 1}`, hex: "#999999" }] })}>
          + Add colour
        </button>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="eyebrow mb-2 text-muted">Stock by size (0 = sold out)</legend>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="eyebrow text-left text-muted"><th className="py-2 pr-3">Colour</th>{SIZES.map((s) => <th key={s} className="px-1 text-center">{s}</th>)}</tr>
            </thead>
            <tbody>
              {d.colors.map((c) => (
                <tr key={c.name} className="border-t hairline">
                  <td className="py-2 pr-3 font-semibold">{c.name}</td>
                  {SIZES.map((s) => (
                    <td key={s} className="p-1">
                      <input aria-label={`${c.name} ${s} stock`} type="number" min={0} className="input !px-2 !py-2 text-center"
                        value={stock(c.name, s)} onChange={(e) => setStock(c.name, s, Number(e.target.value))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <p role="alert" className="mt-6 min-h-6 text-accent-text">{err}</p>
      <div className="mt-2 flex gap-3">
        <button className="btn btn-solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save product"}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function swap<T>(a: T[], i: number, j: number) {
  const c = [...a];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

function L({ t, children, wide }: { t: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="eyebrow mb-1 block text-muted">{t}</span>
      {children}
    </label>
  );
}
