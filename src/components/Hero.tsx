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
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="blob rounded-full absolute -left-[15%] -top-[20%] h-[60%] w-[55%] bg-gradient-to-br from-[color-mix(in_srgb,var(--accent)_25%,transparent)] to-transparent opacity-60"
          style={{ animationDuration: "16s", animationDelay: "0s" }}
        />
        <div
          className="blob rounded-full absolute -right-[10%] top-[10%] h-[55%] w-[50%] bg-gradient-to-br from-[color-mix(in_srgb,var(--logo-a)_20%,transparent)] to-transparent opacity-50"
          style={{ animationDuration: "20s", animationDelay: "-5s" }}
        />
        <div
          className="blob rounded-full absolute -bottom-[15%] left-[15%] h-[45%] w-[40%] bg-gradient-to-br from-[color-mix(in_srgb,var(--accent-text)_12%,transparent)] to-transparent opacity-40"
          style={{ animationDuration: "24s", animationDelay: "-10s" }}
        />
      </div>
      <div className="wrap grid min-h-[94svh] items-center gap-10 py-12 md:grid-cols-12 md:py-16">
        <div className="md:col-span-6 lg:col-span-5">
          <p className="eyebrow tracking-[0.3em] text-accent-text">{banner ? "Featured" : "le.kratos"}</p>
          <h1 className="h-display mt-6 text-[clamp(3.2rem,9vw,7rem)]">{headline}</h1>
          <p className="lede mt-7">{sub}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href={href} className="btn btn-solid">{cta}</Link>
            <Link href="/shop?tag=new" className="btn btn-ghost">New arrivals</Link>
          </div>
        </div>
        <div className="relative md:col-span-6 lg:col-span-7">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[560px] overflow-hidden bg-surface shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] md:ml-auto" style={{ borderRadius: "46% 54% 3% 3% / 22% 22% 3% 3%", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset" }}>
            {banner?.image ? (
              <Image src={banner.image} alt="" fill priority sizes="(min-width:768px) 50vw, 90vw" className="object-cover" />
            ) : product ? (
              <ProductImage product={product} priority sizes="(min-width:768px) 50vw, 90vw" />
            ) : null}
          </div>
          <div aria-hidden className="float absolute -bottom-6 -left-6 h-24 w-24 rounded-full border-2 border-accent-text/15 md:h-32 md:w-32" style={{ animationDelay: "-2s" }} />
          <div aria-hidden className="float absolute -right-4 -top-4 h-16 w-16 rounded-full border border-accent/20" style={{ animationDelay: "-4s", animationDuration: "8s" }} />
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:block" aria-hidden>
        <div className="float flex h-12 w-7 items-start justify-center rounded-full border-2 border-fg/20 pt-2">
          <div className="h-2.5 w-1 animate-bounce rounded-full bg-fg/40" />
        </div>
      </div>
    </section>
  );
}
