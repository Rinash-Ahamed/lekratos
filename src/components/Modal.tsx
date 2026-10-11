"use client";

import { useEffect, useRef } from "react";

/** Accessible dialog: Esc, scroll lock, focus trap, focus returns to the opener. */
export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const f = () => [...(ref.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,select,textarea,[tabindex='0']") ?? [])];
    f()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = f(); if (!els.length) return;
        const a = els[0], z = els[els.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; opener?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="fade-in absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`fade-in relative max-h-[90dvh] w-full overflow-y-auto bg-bg p-6 text-fg shadow-2xl ${wide ? "max-w-5xl" : "max-w-xl"}`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="serif text-2xl">{title}</h2>
          <button onClick={onClose} className="eyebrow min-h-11 px-2">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
