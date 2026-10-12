"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { BrandMark } from "./BrandMark";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/#style-finder-title", label: "Style finder" },
  { href: "/shop?tag=new", label: "New arrivals" },
  { href: "/#story", label: "Our story" },
  { href: "/track", label: "Track order" },
];

export function Header() {
  const { count, wishlist, setCartOpen } = useStore();
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const menuBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => panel.current?.querySelectorAll<HTMLElement>("a[href],button") ?? [];
    focusables()[0]?.focus();
    const button = menuBtn.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenAt(null);
      if (event.key === "Tab") {
        const items = [...focusables(), button!].filter(Boolean);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); button?.focus(); };
  }, [open]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="site-header">
      <div className="site-nav-shell">
        <Link href="/" aria-label="le.kratos — home" className="site-logo"><BrandMark className="h-6 md:h-7" /></Link>
        <nav aria-label="Primary" className="site-desktop-nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="site-nav-link" aria-current={pathname === item.href ? "page" : undefined}><span>{item.label}</span></Link>
          ))}
        </nav>
        <div className="site-nav-actions">
          <Link href="/wishlist" className="site-icon-link" aria-label={`Saved items, ${wishlist.length}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
            {wishlist.length > 0 && <span>{wishlist.length}</span>}
          </Link>
          <button type="button" onClick={() => setCartOpen(true)} className="site-bag" aria-label={`Open bag, ${count} item${count === 1 ? "" : "s"}`}>
            <span>Bag</span><span className="site-bag-count">{String(count).padStart(2, "0")}</span>
          </button>
          <button ref={menuBtn} type="button" className="site-menu-button" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpenAt(open ? null : pathname)}>
            <span>{open ? "Close" : "Menu"}</span><i aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" ref={panel} role="dialog" aria-modal="true" aria-label="Menu" className="mobile-nav-panel">
          <nav aria-label="Mobile">
            {[{ href: "/", label: "Home" }, ...NAV, { href: "/wishlist", label: "Saved" }].map((item, index) => (
              <Link key={item.href} href={item.href} className="mobile-nav-link" style={{ animationDelay: `${index * 45}ms` }}>
                <span>{String(index + 1).padStart(2, "0")}</span>{item.label}<span aria-hidden>↗</span>
              </Link>
            ))}
          </nav>
          <p>Independent artwear<br />Made in India</p>
        </div>
      )}
    </header>
  );
}
