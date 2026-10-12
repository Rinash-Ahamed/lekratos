import Link from "next/link";
import { getSettings } from "@/lib/catalog";
import { FooterGate } from "./FooterGate";

const Arrow = () => <span aria-hidden="true">↗</span>;

export async function Footer() {
  const settings = await getSettings().catch(() => null);
  const whatsapp = settings?.whatsapp ? `https://wa.me/${settings.whatsapp}` : null;
  const instagram = settings?.instagram ? `https://instagram.com/${settings.instagram.replace(/^@/, "")}` : null;
  return (
    <FooterGate>
      <footer className="editorial-footer">
        <div className="footer-topline"><span>Le.Kratos / Artwear</span><span>Designed to move differently</span><span>India — {new Date().getFullYear()}</span></div>
        <div className="footer-main">
          <div className="footer-statement">
            <p>Next chapter</p>
            <h2>Wear the<br /><i>unseen.</i></h2>
            <Link href="/shop" className="footer-shop-link">Enter the shop <Arrow /></Link>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <div>
              <p>Explore</p>
              <Link href="/shop">All pieces</Link>
              <Link href="/shop?tag=new">New arrivals</Link>
              <Link href="/shop?tag=bestseller">Bestsellers</Link>
              <Link href="/wishlist">Saved pieces</Link>
            </div>
            <div>
              <p>Care</p>
              <Link href="/track">Track order</Link>
              <Link href="/shipping">Shipping</Link>
              <Link href="/returns">Returns</Link>
              <Link href="/contact">Contact</Link>
            </div>
            <div>
              <p>Connect</p>
              <Link href="/enquiry">Bulk orders</Link>
              {instagram && <a href={instagram} rel="noopener noreferrer" target="_blank">Instagram <Arrow /></a>}
              {whatsapp && <a href={whatsapp} rel="noopener noreferrer" target="_blank">WhatsApp <Arrow /></a>}
              <a href="#main">Back to top ↑</a>
            </div>
          </nav>
        </div>
        <div className="footer-wordmark" aria-label="le.kratos">LE.KRATOS</div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} le.kratos{settings?.legalName ? ` · ${settings.legalName}` : ""}</span>
          <span>Secure checkout by Razorpay</span>
          <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
        </div>
      </footer>
    </FooterGate>
  );
}
