"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Scroll-reveal with one shared IntersectionObserver (no animation library on the critical path).
 * Content is visible without JS and under reduced motion (see globals.css).
 */
let io: IntersectionObserver | null = null;
function observer() {
  if (!io)
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io?.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
  return io;
}

export function Reveal({ children, delay = 0, as: Tag = "div", className = "" }: { children: ReactNode; delay?: number; as?: ElementType; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = observer();
    o.observe(el);
    return () => o.unobserve(el);
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}
