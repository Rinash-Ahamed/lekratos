import type { MetadataRoute } from "next";
import { getPublishedProducts } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const products = await getPublishedProducts().catch(() => []);
  const fixed = ["", "/shop", "/enquiry", "/shipping", "/returns", "/privacy", "/terms", "/contact", "/track"];
  return [
    ...fixed.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updatedAt ?? p.createdAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
