import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false }, alternates: { canonical: "/checkout" } };

export default function Checkout() {
  return (
    <div className="wrap pb-20 pt-12 md:pt-20">
      <header className="mb-12">
        <p className="eyebrow text-accent-text">Secure purchase</p>
        <h1 className="h-display mt-3 text-[clamp(2.8rem,7vw,5.2rem)]">Checkout</h1>
      </header>
      <CheckoutForm />
    </div>
  );
}
