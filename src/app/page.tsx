import Link from "next/link";
import { getBanners, getCollections, getPublishedProducts, getSettings } from "@/lib/catalog";
import { Hero } from "@/components/Hero";
import { FabricDivider } from "@/components/FabricDivider";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { Reveal } from "@/components/Reveal";
import { Newsletter } from "@/components/Newsletter";
import { inr } from "@/lib/format";

export default async function Home() {
  const [products, collections, banners, settings] = await Promise.all([getPublishedProducts(), getCollections(), getBanners(), getSettings()]);
  const banner = banners.find((b) => b.active);
  const fresh = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const arrivals = (fresh.some((p) => p.tags.includes("new")) ? fresh.filter((p) => p.tags.includes("new")) : fresh).slice(0, 8);
  const best = products.filter((p) => p.tags.includes("bestseller")).slice(0, 4);
  const spotlight = products.find((p) => p.featured) ?? undefined;
  const hasSample = products.some((p) => p.sample);
  const story = settings.brandStory?.body?.trim();
  const facts = [
    settings.shipping.dispatchTime && ["Dispatch", settings.shipping.dispatchTime],
    settings.shipping.deliveryTime && ["Delivery", settings.shipping.deliveryTime],
    settings.shipping.freeAbove && ["Free shipping", `above ${inr(settings.shipping.freeAbove)}`],
    settings.returnsPolicy && ["Returns", "See our policy"],
  ].filter(Boolean) as [string, string][];
  const collTiles = collections
    .map((c) => ({ c, items: products.filter((p) => p.collection === c.slug) }))
    .filter((x) => x.items.length)
    .slice(0, 5);

  return (
    <>
      <Hero banner={banner} product={spotlight ?? arrivals[0]} />
      <FabricDivider to="var(--bg)" className="-mt-px" />

      {products.length === 0 && (
        <section className="wrap py-20 text-center">
          <h2 className="h-section">The first pieces are on their way.</h2>
          <p className="lede mx-auto mt-4">Join the list and we&apos;ll tell you when the collection opens.</p>
          <div className="mt-8 flex justify-center"><Newsletter /></div>
        </section>
      )}

      {facts.length > 0 && (
        <section aria-label="Shopping information" className="wrap -mt-6 mb-12 relative z-10">
          <div className="glass rounded-2xl border hairline p-6 sm:p-8 shadow-sm">
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow text-muted">{k}</dt>
                  <dd className="serif mt-1 text-lg">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {collTiles.length > 0 && (
        <section className="wrap py-20 md:py-28" aria-labelledby="collections-h">
          <Reveal>
            <p className="eyebrow text-accent-text">Collections</p>
            <h2 id="collections-h" className="h-section mt-3 max-w-2xl">Browse by series</h2>
          </Reveal>
          <div className="stagger mt-10 grid gap-5 md:grid-cols-12">
            {collTiles.map(({ c, items }, i) => (
              <Reveal key={c.slug} delay={i * 80} className={i === 0 ? "md:col-span-7" : i === 1 ? "md:col-span-5" : "md:col-span-4"}>
                <Link href={`/shop?collection=${c.slug}`} className="group relative block overflow-hidden bg-sunk">
                  <div className={`relative ${i < 2 ? "aspect-[4/3] md:aspect-[16/11]" : "aspect-[4/5]"}`}>
                    <div className="absolute inset-0 transition-transform duration-[1000ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]">
                      <ProductImage product={items[0]} sizes="(min-width:768px) 40vw, 90vw" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-5 pt-16 text-white md:p-7">
                      <h3 className="serif text-2xl md:text-3xl">{c.name}</h3>
                      <p className="mt-1 text-sm opacity-90">{items.length} piece{items.length === 1 ? "" : "s"} · Explore →</p>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {arrivals.length > 0 && (
        <section className="py-16 md:py-28" aria-labelledby="new-h">
          <div className="wrap flex items-end justify-between gap-6">
            <Reveal>
              <p className="eyebrow text-accent-text">Just in</p>
              <h2 id="new-h" className="h-section mt-3">New arrivals</h2>
            </Reveal>
            <Link href="/shop?tag=new" className="eyebrow link-underline hidden py-1 sm:block">View all</Link>
          </div>
          <div className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[clamp(1.25rem,4vw,3.5rem)] pb-6 pt-2" tabIndex={0} aria-label="New arrivals, scrollable">
            {arrivals.map((p, i) => (
              <div key={p.id} className="w-[72vw] shrink-0 snap-start sm:w-[320px] lg:w-[340px]">
                <ProductCard product={p} priority={i < 2} sizes="340px" />
              </div>
            ))}
          </div>
        </section>
      )}

      {spotlight && (
        <section className="bg-primary text-primary-fg">
          <FabricDivider to="var(--primary)" flip className="-mb-px" />
          <div className="wrap grid items-center gap-12 pb-20 pt-8 md:grid-cols-2 md:pb-32">
            <Reveal>
              <div className="relative aspect-[4/5] overflow-hidden bg-surface"><ProductImage product={spotlight} sizes="(min-width:768px) 45vw, 90vw" /></div>
            </Reveal>
            <Reveal delay={120}>
              <p className="eyebrow opacity-80">Featured piece</p>
              <h2 className="h-section mt-3">{spotlight.name}</h2>
              {spotlight.description && <p className="mt-5 max-w-md text-lg opacity-90">{spotlight.description}</p>}
              <p className="serif mt-6 text-3xl">{inr(spotlight.price)}</p>
              <Link href={`/product/${spotlight.slug}`} className="btn btn-accent mt-8">View piece</Link>
            </Reveal>
          </div>
          <FabricDivider to="var(--bg)" className="-mb-px" />
        </section>
      )}

      {best.length > 0 && (
        <section className="wrap py-20 md:py-28" aria-labelledby="best-h">
          <Reveal>
            <p className="eyebrow text-accent-text">Most loved</p>
            <h2 id="best-h" className="h-section mt-3">Bestsellers</h2>
          </Reveal>
          <div className="stagger mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {best.map((p, i) => (
              <Reveal key={p.id} delay={i * 70}><ProductCard product={p} sizes="(min-width:768px) 25vw, 45vw" /></Reveal>
            ))}
          </div>
        </section>
      )}

      {(story || hasSample) && (
        <section id="story" className="bg-sunk py-20 md:py-28" aria-labelledby="story-h">
          <div className="wrap grid gap-10 md:grid-cols-12">
            <Reveal className="md:col-span-5">
              <p className="eyebrow text-accent-text">Our story</p>
              <h2 id="story-h" className="h-section mt-3">{settings.brandStory?.heading || "Made from the artwork out"}</h2>
            </Reveal>
            <Reveal delay={120} className="md:col-span-7">
              {story ? (
                <div className="space-y-5 text-lg leading-relaxed">{story.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
              ) : (
                <p className="border border-dashed border-line p-5 text-muted">
                  <span className="eyebrow mr-2 bg-accent px-2 py-1 text-accent-fg">Placeholder</span>
                  The owner&apos;s brand story goes here — add it under Admin → Settings → Brand story. This notice disappears once it&apos;s filled in.
                </p>
              )}
            </Reveal>
          </div>
        </section>
      )}

      {settings.testimonials && settings.testimonials.length > 0 && (
        <section className="wrap py-20 md:py-28" aria-labelledby="voices-h">
          <div className="section-line mb-14" />
          <h2 id="voices-h" className="h-section">What people say</h2>
          <div className="stagger mt-10 grid gap-8 md:grid-cols-3">
            {settings.testimonials.map((t, i) => (
              <Reveal key={i} delay={i * 80}>
                <figure className="h-full border-t-2 border-fg pt-5">
                  <blockquote className="serif text-xl leading-snug">“{t.quote}”</blockquote>
                  <figcaption className="eyebrow mt-5 text-muted">{t.name}{t.place ? ` · ${t.place}` : ""}</figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="wrap py-20 md:py-28">
        <div className="section-line mb-14" />
        <div className="grid gap-10 py-6 md:grid-cols-2">
          <Reveal>
            <p className="eyebrow text-accent-text">Teams &amp; events</p>
            <h2 className="h-section mt-3">Bulk &amp; corporate orders</h2>
            <p className="lede mt-4">
              Need tees for a team, college fest or brand activation?
              {settings.bulk.minQuantity ? ` Orders from ${settings.bulk.minQuantity} pieces.` : ""} Send us the details and we&apos;ll reply with a quote.
            </p>
            <Link href="/enquiry" className="btn btn-solid mt-7">Start an enquiry</Link>
          </Reveal>
          <Reveal delay={120}>
            <p className="eyebrow text-accent-text">Stay in the loop</p>
            <h2 className="h-section mt-3">New pieces, first.</h2>
            <div className="mt-6"><Newsletter /></div>
          </Reveal>
        </div>
        <div className="section-line mt-14" />
      </section>
    </>
  );
}
