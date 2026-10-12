import type { Metadata } from "next";
import { Suspense } from "react";
import { getCollections, getPublishedProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";
import { ShopFilters } from "@/components/ShopFilters";
import { inStock } from "@/lib/product";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Object.keys(sp).length > 0;
  return {
    title: "Shop",
    description: "T-shirts with original artwork and photography. Filter by collection, size, colour and price.",
    alternates: { canonical: "/shop" },
    robots: filtered ? { index: false, follow: true } : undefined, // filtered views aren't separate pages for search engines
  };
}

export default async function Shop({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [all, collections] = await Promise.all([getPublishedProducts(), getCollections()]);

  const collection = one(sp.collection), size = one(sp.size), color = one(sp.color), tag = one(sp.tag);
  const q = one(sp.q).trim().toLowerCase(), sort = one(sp.sort);
  const max = Number(one(sp.max)) || Infinity;
  const stock = one(sp.stock) === "1";

  const items = all
    .filter((p) => {
      if (collection && p.collection !== collection) return false;
      if (tag && !p.tags.includes(tag as never)) return false;
      if (p.price > max) return false;
      if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q)) return false;
      if (color && !p.colors.some((c) => c.name === color)) return false;
      if (size && !p.variants.some((v) => v.size === size && v.stock > 0 && (!color || v.color === color))) return false;
      if (stock && !inStock(p)) return false;
      return true;
    })
    .sort((a, b) => (sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : b.createdAt.localeCompare(a.createdAt)));

  const colors = Array.from(new Map(all.flatMap((p) => p.colors).map((c) => [c.name, c])).values());
  const maxPrice = Math.max(1000, Math.ceil(Math.max(...all.map((p) => p.price), 0) / 100) * 100);
  const current = collections.find((c) => c.slug === collection);
  const title = current?.name ?? (tag === "new" ? "New arrivals" : tag === "bestseller" ? "Bestsellers" : tag === "limited" ? "Limited" : "All tees");

  return (
    <div className="wrap pb-16 pt-12 md:pt-20">
      <header className="mb-10 grid gap-4 md:grid-cols-12 md:items-end">
        <h1 className="h-display text-[clamp(3.2rem,8.5vw,6.5rem)] md:col-span-8">{title}</h1>
        <p className="lede md:col-span-4">{current?.blurb ?? "Original artwork and photography, finished as wearable pieces."}</p>
      </header>

      <div className="section-line mb-10" />

      <Suspense fallback={<div className="skeleton mb-10 h-24" aria-hidden />}>
        <ShopFilters collections={collections} colors={colors} maxPrice={maxPrice} />
      </Suspense>

      <p className="eyebrow my-6 text-muted" role="status">{items.length} {items.length === 1 ? "design" : "designs"}</p>

      {items.length === 0 ? (
        <div className="py-24 text-center">
          <p className="serif text-5xl text-gradient">{all.length === 0 ? "The collection is coming soon" : "Nothing matches"}</p>
          <p className="mt-3 text-muted">{all.length === 0 ? "Check back shortly." : "Try loosening a filter."}</p>
        </div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} sizes="(min-width:1280px) 24vw, (min-width:1024px) 32vw, 48vw" />)}
        </div>
      )}
    </div>
  );
}
