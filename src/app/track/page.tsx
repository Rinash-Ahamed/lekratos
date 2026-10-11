import type { Metadata } from "next";
import { TrackForm } from "@/components/TrackForm";

export const metadata: Metadata = { title: "Track your order", alternates: { canonical: "/track" } };

export default async function Track({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return (
    <div className="wrap max-w-3xl pb-10 pt-12 md:pt-16">
      <h1 className="h-display text-[clamp(2.6rem,7vw,5rem)]">Track your order</h1>
      <p className="lede mt-4">Enter your order ID and the phone number you ordered with.</p>
      <TrackForm initialId={id ?? ""} />
    </div>
  );
}
