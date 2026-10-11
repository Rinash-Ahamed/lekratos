"use client";

import { usePathname } from "next/navigation";

/** Hides storefront chrome on /admin without making the footer itself a client component. */
export function FooterGate({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith("/admin") ? null : <>{children}</>;
}
