import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/catalog";
import { PolicyShell, Text } from "@/components/PolicyShell";

export const metadata: Metadata = { title: "Returns & exchanges", alternates: { canonical: "/returns" } };

export default async function Returns() {
  const s = await getSettings();
  return (
    <PolicyShell title="Returns & exchanges" reviewed={!!s.policiesReviewed && !!s.returnsPolicy}>
      {s.returnsPolicy ? <Text text={s.returnsPolicy} /> : (
        <p>The returns and exchange policy hasn&apos;t been published yet. Until it is, please <Link href="/contact" className="link-underline">contact us</Link> before ordering if you have questions about exchanges or refunds.</p>
      )}
      <p>If a payment was taken but your order could not be completed, it is refunded in full to the original payment method.</p>
    </PolicyShell>
  );
}
