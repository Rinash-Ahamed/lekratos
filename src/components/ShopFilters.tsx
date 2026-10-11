"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Collection } from "@/lib/types";
import { SIZES } from "@/lib/types";

export function ShopFilters({
  collections,
  colors,
  maxPrice,
}: {
  collections: Collection[];
  colors: { name: string; hex: string }[];
  maxPrice: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value === null || value === "" || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const get = (k: string) => sp.get(k) ?? "";
  const [q, setQ] = useState(sp.get("q") ?? "");
  const active = ["collection", "size", "color", "max", "stock", "tag", "q"].filter((k) => sp.get(k)).length;

  const chip = (on: boolean) =>
    `min-h-10 border px-3.5 py-2 text-sm transition-colors ${on ? "border-fg bg-fg text-bg" : "hairline hover:border-fg"}`;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between gap-4">
        <button
          className="btn btn-ghost md:hidden"
          aria-expanded={open}
          aria-controls="filters"
          onClick={() => setOpen((v) => !v)}
        >
          Filter{active > 0 && ` (${active})`}
        </button>
        <div className="hidden flex-wrap gap-2 md:flex" role="group" aria-label="Collections">
          <button className={chip(!get("collection"))} onClick={() => set("collection", null)}>All</button>
          {collections.map((c) => (
            <button key={c.slug} className={chip(get("collection") === c.slug)} onClick={() => set("collection", c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
        {active > 0 && (
          <button className="eyebrow link-underline" onClick={() => start(() => router.replace(pathname, { scroll: false }))}>
            Clear all
          </button>
        )}
      </div>

      <form role="search" className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); set("q", q.trim()); }}>
        <label htmlFor="shop-q" className="sr-only">Search designs</label>
        <input id="shop-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs" className="input sm:max-w-sm" />
        <button className="btn btn-ghost" type="submit">Search</button>
        <label htmlFor="shop-sort" className="sr-only">Sort</label>
        <select id="shop-sort" className="input sm:ml-auto sm:max-w-[14rem]" value={get("sort")} onChange={(e) => set("sort", e.target.value)}>
          <option value="">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </form>

      <div
        id="filters"
        className={`${open ? "grid" : "hidden"} mt-6 gap-8 border-y hairline py-8 md:grid md:grid-cols-4`}
        aria-busy={pending}
      >
        <fieldset className="md:hidden">
          <legend className="eyebrow mb-3 text-muted">Collection</legend>
          <div className="flex flex-wrap gap-2">
            {collections.map((c) => (
              <button key={c.slug} className={chip(get("collection") === c.slug)} onClick={() => set("collection", c.slug)}>
                {c.name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-3 text-muted">Size</legend>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button key={s} aria-pressed={get("size") === s} className={chip(get("size") === s)} onClick={() => set("size", s)}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-3 text-muted">Colour</legend>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((c) => (
              <button
                key={c.name}
                aria-label={c.name}
                aria-pressed={get("color") === c.name}
                title={c.name}
                onClick={() => set("color", c.name)}
                className={`h-8 w-8 rounded-full border-2 ${get("color") === c.name ? "border-fg" : "border-transparent"} p-0.5`}
              >
                <span className="block h-full w-full rounded-full border border-black/20" style={{ background: c.hex }} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-3 text-muted">Max price · ₹{get("max") || maxPrice}</legend>
          <input
            type="range"
            min={0}
            max={maxPrice}
            step={100}
            defaultValue={get("max") || maxPrice}
            aria-label="Maximum price"
            className="h-11 w-full accent-[var(--accent-text)]"
            onChange={(e) => set("max", e.target.value === String(maxPrice) ? null : e.target.value)}
          />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={get("stock") === "1"} onChange={() => set("stock", "1")} className="h-4 w-4 accent-[var(--fg)]" />
            In stock only
          </label>
        </fieldset>
      </div>
    </div>
  );
}
