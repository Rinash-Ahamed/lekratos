"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { BrandMark } from "./BrandMark";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?tag=new", label: "New arrivals" },
  { href: "/#story", label: "Our story" },
  { href: "/enquiry", label: "Bulk orders" },
  { href: "/track", label: "Track order" },
];

export function Header() {
  const { count, wishlist, setCartOpen } = useStore();
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname; // closes by itself when the route changes
  const setOpen = (f: boolean | ((v: boolean) => boolean)) => setOpenAt((cur) => ((typeof f === "function" ? f(cur === pathname) : f) ? pathname : null));
  const menuBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // modal behaviour for the mobile menu: scroll lock, Esc, focus in / focus back, Tab trap
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => panel.current?.querySelectorAll<HTMLElement>("a[href],button") ?? [];
    focusables()[0]?.focus();
    const btn = menuBtn.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAt(null);
      if (e.key === "Tab") {
        const f = [...focusables(), btn!].filter(Boolean);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      btn?.focus();
    };
  }, [open]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50 glass border-b border-line/40">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-text/15 to-transparent" aria-hidden />
      <div className="wrap flex h-16 items-center justify-between gap-4 md:h-20">
        <Link href="/" aria-label="le.kratos — home" className="shrink-0">
          <BrandMark className="h-7 md:h-9" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="eyebrow link-underline py-1" aria-current={pathname === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/wishlist" className="eyebrow hidden px-2 py-2 sm:inline link-underline" aria-label={`Saved items, ${wishlist.length}`}>
            Saved{wishlist.length > 0 && ` (${wishlist.length})`}
          </Link>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="eyebrow flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-primary-fg transition-all duration-300"
            aria-label={`Open bag, ${count} item${count === 1 ? "" : "s"}`}
          >
            Bag
            <span className="grid min-w-5 place-items-center bg-accent px-1 text-[0.7rem] text-accent-fg">{count}</span>
          </button>
          <button
            ref={menuBtn}
            type="button"
            className="eyebrow grid min-h-11 place-items-center px-2 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" ref={panel} role="dialog" aria-modal="true" aria-label="Menu" className="fade-in fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto glass-heavy px-5 pb-10 pt-6 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {[{ href: "/", label: "Home" }, ...NAV, { href: "/wishlist", label: "Saved" }].map((n, i) => (
              <Link key={n.href} href={n.href} className="serif border-b hairline py-4 text-3xl" style={{ animationDelay: `${i * 50}ms` }}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
