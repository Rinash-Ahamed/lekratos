import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/catalog";
import { PolicyShell } from "@/components/PolicyShell";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default async function Contact() {
  const s = await getSettings();
  const any = s.email || s.phone || s.whatsapp || s.address || s.instagram;
  return (
    <PolicyShell title="Contact" reviewed>
      {any ? (
        <dl className="grid grid-cols-1 gap-y-4 gap-x-6 sm:grid-cols-[9rem_1fr]">
          {s.email && <><dt className="eyebrow text-muted sm:self-center">Email</dt><dd><a className="link-underline font-medium" href={`mailto:${s.email}`}>{s.email}</a></dd></>}
          {s.phone && <><dt className="eyebrow text-muted sm:self-center">Phone</dt><dd><a className="link-underline font-medium" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a></dd></>}
          {s.whatsapp && <><dt className="eyebrow text-muted sm:self-center">WhatsApp</dt><dd><a className="link-underline font-medium" rel="noopener noreferrer" target="_blank" href={`https://wa.me/${s.whatsapp}`}>Message us</a></dd></>}
          {s.instagram && <><dt className="eyebrow text-muted sm:self-center">Instagram</dt><dd><a className="link-underline font-medium" rel="noopener noreferrer" target="_blank" href={`https://instagram.com/${s.instagram.replace(/^@/, "")}`}>{s.instagram}</a></dd></>}
          {s.address && <><dt className="eyebrow text-muted">Address</dt><dd className="whitespace-pre-line font-medium">{s.address}</dd></>}
          {s.gstin && <><dt className="eyebrow text-muted sm:self-center">GSTIN</dt><dd className="font-medium">{s.gstin}</dd></>}
        </dl>
      ) : (
        <p>Contact details will appear here soon. In the meantime, use the <Link href="/enquiry" className="link-underline">enquiry form</Link>.</p>
      )}
      <p>For bulk or corporate orders use the <Link href="/enquiry" className="link-underline">enquiry form</Link>.</p>
    </PolicyShell>
  );
}
