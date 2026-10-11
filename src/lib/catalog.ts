import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import type { PublicConfig } from "./format";

/**
 * Cached storefront reads (tagged so admin writes & stock changes invalidate them).
 * Money-critical paths (pricing, reservation, payment) bypass this and read the database directly.
 */
export const getPublishedProducts = unstable_cache(() => db.products.published(), ["catalog:products"], { tags: ["catalog"], revalidate: 120 });
export const getCollections = unstable_cache(() => db.collections.all(), ["catalog:collections"], { tags: ["catalog"], revalidate: 300 });
export const getBanners = unstable_cache(() => db.banners.all(), ["catalog:banners"], { tags: ["catalog"], revalidate: 300 });
export const getSettings = unstable_cache(() => db.settings.get(), ["catalog:settings"], { tags: ["settings"], revalidate: 300 });
export const getProductBySlug = (slug: string) =>
  unstable_cache(() => db.products.bySlug(slug), ["catalog:product", slug], { tags: ["catalog"], revalidate: 120 })();

export async function getPublicConfig(): Promise<PublicConfig> {
  const s = await getSettings();
  return {
    flatRate: s.shipping.flatRate ?? 0,
    freeAbove: s.shipping.freeAbove || undefined,
    email: s.email || undefined,
    phone: s.phone || undefined,
    whatsapp: s.whatsapp || undefined,
    instagram: s.instagram || undefined,
  };
}
