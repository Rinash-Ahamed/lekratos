import type { Metadata } from "next";
import { getPublishedProducts } from "@/lib/catalog";
import { WishlistView } from "@/components/WishlistView";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };

export default async function Wishlist() {
  const products = await getPublishedProducts();
  return (
    <div className="wrap pb-20 pt-12 md:pt-20">
      <header className="mb-10">
        <p className="eyebrow text-accent-text">Personal collection</p>
        <h1 className="h-display mt-3 text-[clamp(2.8rem,7vw,5.2rem)]">Saved</h1>
        <p className="lede mt-4">Pieces you&apos;ve curated for later, kept ready whenever inspiration strikes.</p>
      </header>
      <div className="section-line mb-10" />
      <WishlistView products={products} />
    </div>
  );
}
