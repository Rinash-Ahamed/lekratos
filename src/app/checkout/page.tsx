import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false }, alternates: { canonical: "/checkout" } };

export default function Checkout() {
  return (
    <div className="wrap pb-10 pt-12 md:pt-16">
      <h1 className="h-display mb-12 text-[clamp(2.6rem,7vw,5rem)]">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}
