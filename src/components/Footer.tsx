import Link from "next/link";
import { getSettings } from "@/lib/catalog";
import { BrandMark } from "./BrandMark";
import { FooterGate } from "./FooterGate";

export async function Footer() {
  const s = await getSettings().catch(() => null);
  const wa = s?.whatsapp ? `https://wa.me/${s.whatsapp}` : null;
  const ig = s?.instagram ? `https://instagram.com/${s.instagram.replace(/^@/, "")}` : null;
  return (
    <FooterGate>
      <footer className="mt-28 bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_78%,#000)] text-primary-fg">
        <div className="h-px bg-gradient-to-r from-transparent via-primary-fg/10 to-transparent" aria-hidden />
        <div className="wrap pt-16 md:pt-20">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-5">
              <div className="inline-block rounded-sm bg-bg p-4 md:p-5">
                <BrandMark className="h-8 md:h-10" />
              </div>
              <p className="mt-6 max-w-sm opacity-90">Original artwork and photography, finished as wearable pieces.</p>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:col-span-7">
              <div className="flex flex-col gap-3">
                <span className="eyebrow text-accent">Shop</span>
                <Link href="/shop" className="link-underline w-fit transition-colors duration-300">All tees</Link>
                <Link href="/shop?tag=new" className="link-underline w-fit transition-colors duration-300">New arrivals</Link>
                <Link href="/shop?tag=bestseller" className="link-underline w-fit transition-colors duration-300">Bestsellers</Link>
                <Link href="/wishlist" className="link-underline w-fit transition-colors duration-300">Saved</Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="eyebrow text-accent">Help</span>
                <Link href="/track" className="link-underline w-fit transition-colors duration-300">Track order</Link>
                <Link href="/enquiry" className="link-underline w-fit transition-colors duration-300">Bulk &amp; corporate</Link>
                <Link href="/shipping" className="link-underline w-fit transition-colors duration-300">Shipping</Link>
                <Link href="/returns" className="link-underline w-fit transition-colors duration-300">Returns</Link>
                <Link href="/contact" className="link-underline w-fit transition-colors duration-300">Contact</Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="eyebrow text-accent">Legal</span>
                <Link href="/privacy" className="link-underline w-fit transition-colors duration-300">Privacy</Link>
                <Link href="/terms" className="link-underline w-fit transition-colors duration-300">Terms</Link>
                {ig && <a href={ig} rel="noopener noreferrer" target="_blank" className="link-underline w-fit transition-colors duration-300">Instagram</a>}
                {wa && <a href={wa} rel="noopener noreferrer" target="_blank" className="link-underline w-fit transition-colors duration-300">WhatsApp</a>}
              </div>
            </nav>
          </div>
          <div className="mt-16 flex flex-col justify-between gap-3 border-t border-current/20 py-8 text-sm opacity-90 md:flex-row">
            <span>© {new Date().getFullYear()} le.kratos{s?.legalName ? ` · ${s.legalName}` : ""}</span>
            <span>Payments secured by Razorpay</span>
          </div>
        </div>
      </footer>
    </FooterGate>
  );
}
