import type { Metadata } from "next";
import { getSettings } from "@/lib/catalog";
import { PolicyShell, Text } from "@/components/PolicyShell";

export const metadata: Metadata = { title: "Terms of sale", alternates: { canonical: "/terms" } };

export default async function Terms() {
  const s = await getSettings();
  return (
    <PolicyShell title="Terms of sale" reviewed={!!s.policiesReviewed && !!s.termsText}>
      {s.termsText ? <Text text={s.termsText} /> : (
        <>
          <p>This starting draft summarises how orders on this website work.</p>
          <h2>Orders and prices</h2>
          <p>Prices are shown in Indian rupees. The amount you pay is calculated by our server at checkout from current prices, any promo code and shipping. An order is confirmed only after your payment has been verified.</p>
          <h2>Stock</h2>
          <p>When checkout begins, items are held for a limited time. Submitting a transaction reference or screenshot does not prove payment and does not confirm an order. If verification happens after the hold expires, stock is checked again; unavailable stock is never silently confirmed.</p>
          <h2>Delivery, returns and refunds</h2>
          <p>See the shipping and returns pages for the current policies.</p>
        </>
      )}
    </PolicyShell>
  );
}
