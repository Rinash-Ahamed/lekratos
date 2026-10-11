import "server-only";
import { db } from "./db";
import { shippingFor } from "./format";
import type { OrderItem, Product, Size } from "./types";
import { SIZES } from "./types";

export interface RequestedLine {
  productId: string;
  color: string;
  size: Size;
  qty: number;
}

export interface LineIssue {
  index: number;
  message: string;
  available: number;
}

export interface PriceOk {
  ok: true;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode?: string;
  offerLabel?: string;
}
export type PriceResult = PriceOk | { ok: false; error: string; issues?: LineIssue[] };

/**
 * Server-authoritative pricing. Prices, stock, discounts and shipping always come from
 * the database / store settings. The client only says WHAT it wants, never HOW MUCH it costs.
 */
export async function priceCart(lines: RequestedLine[], code?: string): Promise<PriceResult> {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 30) return { ok: false, error: "Your bag is empty" };

  const cache = new Map<string, Product | undefined>();
  const items: OrderItem[] = [];
  const issues: LineIssue[] = [];
  const seen = new Set<string>();

  for (const [index, l] of lines.entries()) {
    const qty = Math.floor(Number(l.qty));
    if (!SIZES.includes(l.size) || !(qty >= 1 && qty <= 10)) return { ok: false, error: "Invalid item in bag" };
    const k = `${l.productId}|${l.color}|${l.size}`;
    if (seen.has(k)) return { ok: false, error: "Invalid item in bag" }; // client must merge duplicate lines
    seen.add(k);

    const id = String(l.productId);
    if (!cache.has(id)) cache.set(id, await db.products.byId(id));
    const p = cache.get(id);
    if (!p || !p.published) {
      issues.push({ index, message: "No longer available", available: 0 });
      continue;
    }
    const v = p.variants.find((x) => x.color === l.color && x.size === l.size);
    if (!v || v.stock < qty) {
      issues.push({
        index,
        message: !v || v.stock === 0 ? `${p.name} (${l.color}, ${l.size}) is sold out` : `Only ${v.stock} left of ${p.name} (${l.color}, ${l.size})`,
        available: v?.stock ?? 0,
      });
      continue;
    }
    items.push({ productId: p.id, name: p.name, color: l.color, size: l.size, qty, price: p.price });
  }
  if (issues.length) return { ok: false, error: issues[0].message, issues };

  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  let discount = 0;
  let offerLabel: string | undefined;
  let couponCode: string | undefined;
  if (code?.trim()) {
    const wanted = code.trim().toUpperCase();
    const offer = (await db.offers.all()).find((o) => o.active && o.code.toUpperCase() === wanted);
    if (!offer) return { ok: false, error: "That code isn't valid" };
    if (subtotal < offer.minSubtotal) return { ok: false, error: `This code needs a minimum order of ₹${offer.minSubtotal}` };
    discount = Math.round((subtotal * offer.percent) / 100);
    offerLabel = offer.label;
    couponCode = offer.code;
  }
  const settings = await db.settings.get();
  const shipping = shippingFor(subtotal - discount, settings.shipping);
  return { ok: true, items, subtotal, shipping, discount, total: subtotal - discount + shipping, couponCode, offerLabel };
}
