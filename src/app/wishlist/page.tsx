import type { Metadata } from "next";
import { getPublishedProducts } from "@/lib/catalog";
import { WishlistView } from "@/components/WishlistView";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };

export default async function Wishlist() {
  const products = await getPublishedProducts();
  return (
    <div className="wrap pb-10 pt-12 md:pt-16">
      <h1 className="h-display text-[clamp(2.6rem,7vw,5rem)]">Saved</h1>
      <WishlistView products={products} />
    </div>
  );
}
