import type { Metadata } from "next";
import { getSettings } from "@/lib/catalog";
import { PolicyShell, Text } from "@/components/PolicyShell";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default async function Privacy() {
  const s = await getSettings();
  return (
    <PolicyShell title="Privacy policy" reviewed={!!s.policiesReviewed && !!s.privacyPolicy}>
      {s.privacyPolicy ? <Text text={s.privacyPolicy} /> : (
        <>
          <p>This starting draft describes what this website actually does with your information.</p>
          <h2>What we collect</h2>
          <p>When you order: your name, phone number, email and delivery address. When you send an enquiry: the details you enter and any reference image you attach. When you join the list: your email address.</p>
          <h2>Payments</h2>
          <p>Payments are handled by Razorpay. Your card, UPI or bank details go to Razorpay and never touch our servers; we receive only the payment reference and status.</p>
          <h2>How we use it</h2>
          <p>To fulfil and deliver orders, answer enquiries, prevent fraud and misuse, and (only if you joined the list) tell you about new pieces.</p>
          <h2>What is stored on your device</h2>
          <p>Your bag, saved items and chosen colour theme are kept in your browser&apos;s storage. We don&apos;t use advertising trackers.</p>
          <h2>Retention and your rights</h2>
          <p>Order records are kept as needed for accounting and support. To ask for a copy, correction or deletion of your information, contact us using the details on the contact page.</p>
        </>
      )}
    </PolicyShell>
  );
}
