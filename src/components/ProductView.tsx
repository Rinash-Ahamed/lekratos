"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Product, Size, StoreSettings } from "@/lib/types";
import { SIZES } from "@/lib/types";
import { inr } from "@/lib/format";
import { useStore } from "@/lib/store";
import { stockFor } from "@/lib/product";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";
import { WishlistButton } from "./WishlistButton";

type Info = Pick<StoreSettings, "shipping" | "returnsPolicy" | "sizeChart" | "bulk">;

export function ProductView({ product, info }: { product: Product; info: Info }) {
  const { add, toggleWish, wishlist } = useStore();
  const [ci, setCi] = useState(0);
  const [size, setSize] = useState<Size | null>(null);
  const [qty, setQty] = useState(1);
  const [frame, setFrame] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [guide, setGuide] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  const color = product.colors[ci];
  const hasPhotos = product.images.length > 0;
  // With real photography the gallery is the photos; otherwise one frame per colourway of the placeholder artwork.
  const frames = hasPhotos ? product.images.map((_, i) => ({ imageIndex: i, colorIndex: ci })) : product.colors.map((_, i) => ({ imageIndex: 0, colorIndex: i }));
  const cur = frames[Math.min(frame, frames.length - 1)];

  const available = useMemo(() => Object.fromEntries(SIZES.map((s) => [s, stockFor(product, color.name, s)])) as Record<Size, number>, [product, color]);
  const selectedStock = size ? available[size] : 0;
  const maxQty = Math.min(10, selectedStock || 10);
  const soldOut = SIZES.every((s) => available[s] === 0);
  const saved = wishlist.includes(product.id);

  const addToBag = () => {
    if (!size) { setError("Choose a size first"); return; }
    if (!selectedStock) return;
    setError("");
    add({ productId: product.id, slug: product.slug, name: product.name, price: product.price, color: color.name, colorHex: color.hex, size, qty: Math.min(qty, selectedStock), art: product.art, image: product.images[0] });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const facts: [string, string | undefined][] = [["Fabric", product.fabric], ["Fit", product.fit], ["Care", product.care]];
  const delivery = [info.shipping.dispatchTime && `Dispatch: ${info.shipping.dispatchTime}`, info.shipping.deliveryTime && `Delivery: ${info.shipping.deliveryTime}`, info.shipping.coverage, info.shipping.freeAbove ? `Free shipping above ${inr(info.shipping.freeAbove)}` : undefined].filter(Boolean) as string[];

  return (
    <div className="wrap grid gap-8 pb-28 pt-6 md:grid-cols-12 md:gap-12 md:pb-16 md:pt-10">
      {/* Gallery */}
      <div className="md:col-span-7">
        <div
          className="relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-sunk"
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onPointerLeave={() => setZoom(null)}
        >
          <div className="absolute inset-0 transition-transform duration-200 ease-out" style={zoom ? { transform: "scale(1.7)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}>
            <ProductImage product={product} imageIndex={cur.imageIndex} colorIndex={cur.colorIndex} priority sizes="(min-width:768px) 55vw, 100vw" />
          </div>
          <button type="button" onClick={() => setLightbox(true)} className="eyebrow absolute bottom-3 right-3 min-h-11 bg-bg/90 px-4 backdrop-blur">Enlarge</button>
          {frames.length > 1 && (
            <>
              <button aria-label="Previous image" className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-bg/85 md:hidden" onClick={() => setFrame((frame + frames.length - 1) % frames.length)}>‹</button>
              <button aria-label="Next image" className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-bg/85 md:hidden" onClick={() => setFrame((frame + 1) % frames.length)}>›</button>
            </>
          )}
        </div>
        {frames.length > 1 && (
          <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Product images">
            {frames.map((f, i) => (
              <li key={i}>
                <button aria-label={`Show image ${i + 1}`} aria-current={frame === i} onClick={() => { setFrame(i); if (!hasPhotos) setCi(i); }} className={`relative block h-20 w-16 overflow-hidden border-2 ${frame === i ? "border-fg" : "border-transparent"}`}>
                  <ProductImage product={product} imageIndex={f.imageIndex} colorIndex={f.colorIndex} sizes="64px" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {product.sample && <p className="mt-3 text-sm text-muted">Placeholder artwork — real photography replaces this when the owner uploads it.</p>}
      </div>

      {/* Details */}
      <div className="md:col-span-5">
        <div className="md:sticky md:top-28">
          <nav aria-label="Breadcrumb" className="eyebrow text-muted">
            <Link href="/shop" className="link-underline">Shop</Link> / <span aria-current="page">{product.name}</span>
          </nav>
          <h1 className="h-display mt-4 text-[clamp(2.4rem,5vw,4rem)]">{product.name}</h1>
          <p className="mt-4 text-2xl font-semibold">
            {product.compareAt ? <span className="mr-3 text-base font-normal text-muted line-through">{inr(product.compareAt)}</span> : null}
            {inr(product.price)}
          </p>
          {product.story && <p className="mt-5 max-w-md text-muted">{product.story}</p>}

          <fieldset className="mt-8">
            <legend className="eyebrow mb-3">Colour — {color.name}</legend>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c, i) => (
                <button key={c.name} aria-label={c.name} aria-pressed={ci === i} onClick={() => { setCi(i); setSize(null); setQty(1); if (!hasPhotos) setFrame(i); }} className={`h-11 w-11 rounded-full border-2 p-1 ${ci === i ? "border-fg" : "border-transparent"}`}>
                  <span className="block h-full w-full rounded-full border border-black/20" style={{ background: c.hex }} />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-7">
            <legend className="eyebrow mb-3 flex w-full justify-between">
              <span>Size</span>
              {info.sizeChart ? <button type="button" onClick={() => setGuide(true)} className="link-underline min-h-6 text-muted">Size guide</button> : null}
            </legend>
            <div className="grid grid-cols-6 gap-2">
              {SIZES.map((s) => {
                const out = available[s] === 0;
                return (
                  <button key={s} disabled={out} aria-pressed={size === s} aria-label={out ? `${s}, sold out` : s}
                    onClick={() => { setSize(s); setError(""); setQty((q) => Math.min(q, available[s])); }}
                    className={`min-h-12 border text-sm font-semibold ${size === s ? "border-fg bg-fg text-bg" : "hairline hover:border-fg"} ${out ? "cursor-not-allowed text-muted line-through opacity-50" : ""}`}>
                    {s}
                  </button>
                );
              })}
            </div>
            <p role="alert" className="mt-2 min-h-5 text-sm text-accent-text">
              {error || (size && selectedStock > 0 && selectedStock <= 3 ? `Only ${selectedStock} left in ${size}` : soldOut ? "This colour is sold out" : "")}
            </p>
          </fieldset>

          <div className="mt-3 hidden items-center gap-3 md:flex">
            <Stepper qty={qty} setQty={setQty} max={maxQty} />
            <button className="btn btn-solid flex-1 !py-4" onClick={addToBag} disabled={soldOut}>{soldOut ? "Sold out" : added ? "Added ✓" : `Add to bag · ${inr(product.price * qty)}`}</button>
            <WishlistButton productId={product.id} name={product.name} className="border hairline" />
          </div>

          <div className="mt-8 divide-y divide-line border-y hairline text-sm">
            {product.description && <Detail t="Details" open><p>{product.description}</p></Detail>}
            {facts.some(([, v]) => v) && (
              <Detail t="Fabric, fit & care">
                <dl className="grid grid-cols-[5rem_1fr] gap-y-2">{facts.filter(([, v]) => v).map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>))}</dl>
              </Detail>
            )}
            {delivery.length > 0 && <Detail t="Delivery"><ul className="space-y-1">{delivery.map((d) => <li key={d}>{d}</li>)}</ul><p className="mt-2"><Link href="/shipping" className="link-underline">Full shipping details</Link></p></Detail>}
            {info.returnsPolicy && <Detail t="Returns"><p className="line-clamp-4 whitespace-pre-line">{info.returnsPolicy}</p><p className="mt-2"><Link href="/returns" className="link-underline">Returns policy</Link></p></Detail>}
          </div>
          <p className="mt-6 text-sm text-muted">Need {info.bulk.minQuantity ?? "10"} or more? <Link href={`/enquiry?product=${encodeURIComponent(product.name)}`} className="link-underline text-fg">Ask about bulk orders</Link></p>
        </div>
      </div>

      {/* Sticky mobile purchase bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t hairline bg-bg/95 px-3 pt-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <Stepper qty={qty} setQty={setQty} max={maxQty} compact />
          <button className="btn btn-solid flex-1 !px-3" onClick={addToBag} disabled={soldOut}>{soldOut ? "Sold out" : added ? "Added ✓" : size ? `Add · ${inr(product.price * qty)}` : "Select size"}</button>
          <button aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"} onClick={() => toggleWish(product.id)} className="grid h-12 w-12 shrink-0 place-items-center border hairline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.4 3 5 6.4 5c2 0 3.8 1.1 5.6 3.2C13.8 6.1 15.6 5 17.6 5 21 5 22.9 8.4 21.5 11.7 19.5 16.4 12 21 12 21z" /></svg>
          </button>
        </div>
      </div>

      <Modal open={lightbox} onClose={() => setLightbox(false)} title={product.name} wide>
        <div className="relative mx-auto aspect-[4/5] max-h-[70dvh] bg-sunk"><ProductImage product={product} imageIndex={cur.imageIndex} colorIndex={cur.colorIndex} sizes="90vw" /></div>
      </Modal>
      <Modal open={guide} onClose={() => setGuide(false)} title="Size guide">
        {info.sizeChart && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left text-muted">Measurements in {info.sizeChart.unit === "in" ? "inches" : "centimetres"}</caption>
              <thead><tr className="border-b hairline"><th scope="col" className="py-2 pr-4">Size</th>{info.sizeChart.columns.map((c) => <th key={c} scope="col" className="py-2 pr-4">{c}</th>)}</tr></thead>
              <tbody>{info.sizeChart.rows.map((r) => <tr key={r.size} className="border-b hairline"><th scope="row" className="py-2 pr-4">{r.size}</th>{r.values.map((v, i) => <td key={i} className="py-2 pr-4">{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stepper({ qty, setQty, max, compact }: { qty: number; setQty: (n: number) => void; max: number; compact?: boolean }) {
  return (
    <div className={`flex items-center border hairline ${compact ? "h-12" : "h-14"}`}>
      <button aria-label="Decrease quantity" className="h-full w-10 text-lg" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
      <span className="w-6 text-center font-semibold" aria-live="polite">{qty}</span>
      <button aria-label="Increase quantity" className="h-full w-10 text-lg" onClick={() => setQty(Math.min(max, qty + 1))}>+</button>
    </div>
  );
}

function Detail({ t, children, open }: { t: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group py-4" open={open}>
      <summary className="eyebrow flex min-h-6 cursor-pointer list-none justify-between"><span>{t}</span><span className="transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
      <div className="mt-3 text-muted">{children}</div>
    </details>
  );
}
