import type { Metadata } from "next";
import { getPublishedProducts, getSettings } from "@/lib/catalog";
import { EnquiryForm } from "@/components/EnquiryForm";

export const metadata: Metadata = {
  title: "Bulk & corporate enquiries",
  description: "Teams, events and stores: send quantities and sizes and we'll reply with a quote.",
  alternates: { canonical: "/enquiry" },
};

export default async function Enquiry({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  const [products, s] = await Promise.all([getPublishedProducts(), getSettings()]);
  return (
    <div className="wrap pb-20 pt-12 md:pt-20">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <header className="lg:col-span-5">
          <div className="mb-4 inline-flex items-center gap-2.5">
            <span className="h-0.5 w-8 bg-accent" aria-hidden="true" />
            <p className="eyebrow text-accent-text">Bulk &amp; corporate</p>
          </div>
          <h1 className="h-display text-[clamp(2.8rem,6.5vw,4.8rem)]">Make it a team thing</h1>
          <p className="lede mt-6">
            Tell us what you need.{s.bulk.minQuantity ? ` Orders from ${s.bulk.minQuantity} pieces.` : ""} This is for ordering existing designs in volume — a reference image is only for discussion, not an automatic custom print.
            {s.bulk.responseTime ? ` We usually reply ${s.bulk.responseTime}.` : ""}
          </p>
          <div className="section-line my-8 lg:hidden" />
        </header>
        <div className="lg:col-span-7">
          <div className="glass rounded-2xl border hairline p-6 sm:p-10 shadow-xs">
            <EnquiryForm products={products.map((p) => p.name)} defaultProduct={product ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}
