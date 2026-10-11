/* eslint-disable no-restricted-syntax -- JSON-LD built from our own data and "<"-escaped */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getProductBySlug, getPublishedProducts, getSettings } from "@/lib/catalog";
import { ProductView } from "@/components/ProductView";
import { ProductCard } from "@/components/ProductCard";
import { inStock } from "@/lib/product";
import { siteUrl } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p || !p.published) return { title: "Not found", robots: { index: false } };
  const desc = (p.description || p.story || `${p.name} by le.kratos`).slice(0, 160);
  return {
    title: p.name,
    description: desc,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { type: "website", title: `${p.name} — le.kratos`, description: desc, url: `/product/${p.slug}`, images: p.images[0] ? [{ url: p.images[0] }] : undefined },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const [product, all, settings, h] = await Promise.all([getProductBySlug(slug), getPublishedProducts(), getSettings(), headers()]);
  if (!product || !product.published) notFound();
  const nonce = h.get("x-nonce") ?? undefined;
  const sameCollection = all.filter((p) => p.id !== product.id && p.collection === product.collection);
  const related = [...sameCollection, ...all.filter((p) => p.id !== product.id && p.collection !== product.collection)].slice(0, 4);
  const site = siteUrl();

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.description || undefined,
        image: product.images.length ? product.images : undefined,
        sku: product.id,
        brand: { "@type": "Brand", name: "le.kratos" },
        offers: {
          "@type": "Offer",
          url: `${site}/product/${product.slug}`,
          priceCurrency: "INR",
          price: product.price,
          availability: inStock(product) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site },
          { "@type": "ListItem", position: 2, name: "Shop", item: `${site}/shop` },
          { "@type": "ListItem", position: 3, name: product.name, item: `${site}/product/${product.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <ProductView product={product} info={{ shipping: settings.shipping, returnsPolicy: settings.returnsPolicy, sizeChart: settings.sizeChart, bulk: settings.bulk }} />
      {related.length > 0 && (
        <section className="wrap pb-10 pt-6" aria-labelledby="more">
          <h2 id="more" className="h-section mb-8">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {related.map((p) => <ProductCard key={p.id} product={p} sizes="(min-width:768px) 25vw, 48vw" />)}
          </div>
        </section>
      )}
    </>
  );
}
