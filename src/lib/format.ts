import type { StoreSettings } from "./types";

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const dateTimeLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Shipping comes ONLY from the owner's store settings. Unset = 0 (and the admin
 * launch checklist flags it) – we never invent a rate.
 */
export function shippingFor(subtotalAfterDiscount: number, shipping: StoreSettings["shipping"]): number {
  const flat = Math.max(0, Math.floor(shipping.flatRate ?? 0));
  if (subtotalAfterDiscount <= 0) return 0;
  if (shipping.freeAbove && subtotalAfterDiscount >= shipping.freeAbove) return 0;
  return flat;
}

/** Public subset of settings safe to hand to client components. */
export interface PublicConfig {
  flatRate: number;
  freeAbove?: number;
  email?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
}
