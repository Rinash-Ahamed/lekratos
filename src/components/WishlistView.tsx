"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { ProductCard } from "./ProductCard";

export function WishlistView({ products }: { products: Product[] }) {
  const { wishlist, hydrated } = useStore();
  const saved = products.filter((p) => wishlist.includes(p.id));

  if (!hydrated) return <div className="mt-12 min-h-[40vh]" aria-busy="true" />;
  if (saved.length === 0)
    return (
      <div className="mt-12 py-20">
        <p className="text-lg text-muted">Tap the heart on any tee to keep it here.</p>
        <Link href="/shop" className="btn btn-solid mt-8">Browse the shop</Link>
      </div>
    );
  return (
    <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
      {saved.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
