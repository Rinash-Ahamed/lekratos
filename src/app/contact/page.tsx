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
        <dl className="grid grid-cols-[8rem_1fr] gap-y-3">
          {s.email && <><dt className="text-muted">Email</dt><dd><a className="link-underline" href={`mailto:${s.email}`}>{s.email}</a></dd></>}
          {s.phone && <><dt className="text-muted">Phone</dt><dd><a className="link-underline" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a></dd></>}
          {s.whatsapp && <><dt className="text-muted">WhatsApp</dt><dd><a className="link-underline" rel="noopener noreferrer" target="_blank" href={`https://wa.me/${s.whatsapp}`}>Message us</a></dd></>}
          {s.instagram && <><dt className="text-muted">Instagram</dt><dd><a className="link-underline" rel="noopener noreferrer" target="_blank" href={`https://instagram.com/${s.instagram.replace(/^@/, "")}`}>{s.instagram}</a></dd></>}
          {s.address && <><dt className="text-muted">Address</dt><dd className="whitespace-pre-line">{s.address}</dd></>}
          {s.gstin && <><dt className="text-muted">GSTIN</dt><dd>{s.gstin}</dd></>}
        </dl>
      ) : (
        <p>Contact details will appear here soon. In the meantime, use the <Link href="/enquiry" className="link-underline">enquiry form</Link>.</p>
      )}
      <p>For bulk or corporate orders use the <Link href="/enquiry" className="link-underline">enquiry form</Link>.</p>
    </PolicyShell>
  );
}
