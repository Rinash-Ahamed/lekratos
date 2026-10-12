import type { Metadata } from "next";
import { TrackForm } from "@/components/TrackForm";

export const metadata: Metadata = { title: "Track your order", alternates: { canonical: "/track" } };

export default async function Track({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return (
    <div className="wrap max-w-3xl pb-20 pt-12 md:pt-20">
      <header>
        <p className="eyebrow text-accent-text">Order status</p>
        <h1 className="h-display mt-3 text-[clamp(2.8rem,7vw,5.2rem)]">Track your order</h1>
        <p className="lede mt-4">Enter your order ID and the phone number you ordered with.</p>
      </header>
      <div className="section-line my-10" />
      <TrackForm initialId={id ?? ""} />
    </div>
  );
}
