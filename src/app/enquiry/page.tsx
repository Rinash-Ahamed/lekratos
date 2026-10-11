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
    <div className="wrap grid gap-12 pb-10 pt-12 md:grid-cols-12 md:pt-16">
      <header className="md:col-span-5">
        <p className="eyebrow text-accent-text">Bulk &amp; corporate</p>
        <h1 className="h-display mt-4 text-[clamp(2.6rem,6vw,4.6rem)]">Make it a team thing</h1>
        <p className="lede mt-6">
          Tell us what you need.{s.bulk.minQuantity ? ` Orders from ${s.bulk.minQuantity} pieces.` : ""} This is for ordering existing designs in volume — a reference image is only for discussion, not an automatic custom print.
          {s.bulk.responseTime ? ` We usually reply ${s.bulk.responseTime}.` : ""}
        </p>
      </header>
      <div className="md:col-span-7">
        <EnquiryForm products={products.map((p) => p.name)} defaultProduct={product ?? ""} />
      </div>
    </div>
  );
}
