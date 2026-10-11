import Image from "next/image";
import Link from "next/link";
import type { Banner, Product } from "@/lib/types";
import { ProductImage } from "./ProductImage";

/**
 * Cinematic, content-first hero. No JS: layered fabric folds drift slowly (transform only) behind the copy,
 * and the image is the LCP element (priority). Copy comes from the active admin banner when there is one.
 */
export function Hero({ banner, product }: { banner?: Banner; product?: Product }) {
  const headline = banner?.headline || "Art you can wear.";
  const sub = banner?.sub || "Original artwork and photography, finished as T-shirts you'll reach for first.";
  const cta = banner?.cta || "Shop the collection";
  const href = banner?.href || "/shop";
  return (
    <section className="relative isolate overflow-hidden bg-sunk">
      <div aria-hidden className="fabric-drift pointer-events-none absolute -inset-[8%] -z-10 opacity-70"
        style={{ background: "radial-gradient(60% 50% at 78% 30%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 70%), radial-gradient(50% 60% at 12% 85%, color-mix(in srgb, var(--logo-a) 22%, transparent), transparent 70%)" }} />
      <div className="wrap grid min-h-[min(86svh,820px)] items-center gap-10 py-12 md:grid-cols-12 md:py-16">
        <div className="md:col-span-6 lg:col-span-5">
          <p className="eyebrow text-accent-text">{banner ? "Featured" : "le.kratos"}</p>
          <h1 className="h-display mt-5 text-[clamp(2.8rem,8vw,6.2rem)]">{headline}</h1>
          <p className="lede mt-6">{sub}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={href} className="btn btn-solid">{cta}</Link>
            <Link href="/shop?tag=new" className="btn btn-ghost">New arrivals</Link>
          </div>
        </div>
        <div className="relative md:col-span-6 lg:col-span-7">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[560px] overflow-hidden bg-surface shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] md:ml-auto" style={{ borderRadius: "46% 54% 3% 3% / 22% 22% 3% 3%" }}>
            {banner?.image ? (
              <Image src={banner.image} alt="" fill priority sizes="(min-width:768px) 50vw, 90vw" className="object-cover" />
            ) : product ? (
              <ProductImage product={product} priority sizes="(min-width:768px) 50vw, 90vw" />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
