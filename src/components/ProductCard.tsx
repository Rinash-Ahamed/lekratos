"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/format";
import { inStock, totalStock } from "@/lib/product";
import { ProductImage } from "./ProductImage";
import { WishlistButton } from "./WishlistButton";

export function ProductCard({ product, ratio = "aspect-[4/5]", priority = false, sizes = "(min-width:1024px) 25vw, (min-width:640px) 45vw, 80vw" }: {
  product: Product; ratio?: string; priority?: boolean; sizes?: string;
}) {
  const [ci, setCi] = useState(0);
  const sold = !inStock(product);
  const left = totalStock(product);
  const tag = sold ? "Sold out" : product.tags.includes("limited") ? "Limited" : product.tags.includes("new") ? "New" : left > 0 && left <= 5 ? `Only ${left} left` : null;

  return (
    <article className="group relative card-3d">
      <Link
        href={`/product/${product.slug}`}
        className="block"
        onPointerEnter={(e) => e.pointerType === "mouse" && product.colors.length > 1 && setCi(1)}
        onPointerLeave={() => setCi(0)}
      >
        <div className={`relative overflow-hidden bg-sunk ${ratio}`}>
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 transition-all duration-500 group-hover:bg-black/[0.06]">
            <span className="eyebrow translate-y-3 text-fg opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-60">View</span>
          </div>
          <div className="absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]">
            <ProductImage product={product} colorIndex={ci} priority={priority} sizes={sizes} />
          </div>
          {tag && <span className={`eyebrow absolute left-3 top-3 rounded-sm px-2.5 py-1.5 ${sold ? "bg-primary text-primary-fg" : "bg-accent text-accent-fg"}`}>{tag}</span>}
        </div>
        <div className="mt-4 flex items-start justify-between gap-4">
          <h3 className="serif text-xl leading-snug md:text-2xl">{product.name}</h3>
          <p className="shrink-0 pt-1 text-right text-sm md:text-base">
            {product.compareAt ? <span className="mr-2 text-muted line-through">{inr(product.compareAt)}</span> : null}
            <span className="font-semibold">{inr(product.price)}</span>
          </p>
        </div>
        <ul className="mt-2 flex gap-1.5" aria-label="Colours">
          {product.colors.map((c) => (
            <li key={c.name} title={c.name} className="h-3 w-3 rounded-full border border-fg/30" style={{ background: c.hex }}><span className="sr-only">{c.name}</span></li>
          ))}
        </ul>
      </Link>
      <WishlistButton productId={product.id} name={product.name} className="absolute right-3 top-3" />
    </article>
  );
}
