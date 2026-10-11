export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL";
export const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

export interface ColorOption {
  name: string;
  hex: string;
}

export interface Variant {
  color: string; // ColorOption.name
  size: Size;
  stock: number;
}

export interface Collection {
  slug: string;
  name: string;
  blurb: string;
  order?: number;
}

export type ArtKind = "sun" | "grid" | "wave" | "eye" | "bloom" | "stripe";

export interface Product {
  id: string;
  slug: string;
  name: string;
  collection: string; // Collection.slug
  price: number; // INR, whole rupees
  compareAt?: number;
  description: string;
  story: string;
  /** Owner-provided product facts. Empty = not yet provided (never invented). */
  fabric?: string;
  fit?: string;
  care?: string;
  colors: ColorOption[];
  variants: Variant[];
  /** Uploaded photography (multiple angles). When empty, placeholder artwork is rendered. */
  images: string[];
  /** Seed for placeholder artwork (used only while no photography is uploaded) */
  art: { kind: ArtKind; seed: number };
  tags: ("new" | "bestseller" | "limited" | "trending")[];
  featured?: boolean;
  /** true on bundled demo records, so they are clearly labelled and easy to delete */
  sample?: boolean;
  createdAt: string;
  updatedAt?: string;
  published: boolean;
}

/**
 * pending   – stock reserved, waiting for payment
 * paid      – payment captured & verified with the gateway
 * packed / shipped / delivered – fulfilment
 * cancelled – cancelled by admin (stock released)
 * expired   – reservation lapsed without payment (stock released)
 * failed    – payment failed (stock released)
 * refunded  – fully refunded
 * review    – money received but the order can't be fulfilled automatically (e.g. stock gone) → needs admin action
 */
export type OrderStatus =
  | "pending"
  | "paid"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "expired"
  | "failed"
  | "refunded"
  | "review";

export const PAID_STATUSES: OrderStatus[] = ["paid", "packed", "shipped", "delivered"];

export interface OrderItem {
  productId: string;
  name: string;
  color: string;
  size: Size;
  qty: number;
  price: number;
}

export interface OrderEvent {
  at: string;
  type: string;
  note?: string;
}

export interface Refund {
  id: string;
  amount: number; // rupees
  at: string;
  by: string;
  note?: string;
  restocked: boolean;
}

export interface Order {
  id: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paid: boolean;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode?: string;
  total: number;
  customer: { name: string; phone: string; email: string };
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  trackingNote?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
  /** Idempotency key supplied by the checkout page – one live order per key */
  checkoutKey?: string;
  /** sha256 of the customer's order access token (the raw token is only ever returned once) */
  tokenHash?: string;
  reservedUntil?: string;
  stockReserved?: boolean;
  payment?: { amountPaise: number; currency: string; method?: string; capturedAt?: string };
  refunds?: Refund[];
  refundedTotal?: number;
  /** Additional captured payments for the same order (customer paid twice) – auto-refunded, flagged until done */
  extraPayments?: { id: string; amountPaise: number; refundId?: string }[];
  events?: OrderEvent[];
}

export interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  product: string;
  quantity: number;
  sizes: Partial<Record<Size, number>>;
  location: string;
  notes: string;
  /** Private storage key of the optional reference image (never a public URL) */
  attachmentKey?: string;
  /** legacy (v1) public URL – read-only, kept so old records still display */
  referenceImage?: string;
  status: "new" | "contacted" | "quoted" | "closed";
  internalNotes?: string;
  followUpAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Offer {
  id: string;
  code: string;
  label: string;
  percent: number;
  minSubtotal: number;
  active: boolean;
}

export interface Banner {
  id: string;
  headline: string;
  sub: string;
  cta: string;
  href: string;
  image?: string;
  active: boolean;
}

export interface SizeChart {
  unit: "in" | "cm";
  columns: string[]; // e.g. ["Chest", "Length"]
  rows: { size: Size; values: string[] }[];
}

/** Everything the business owner provides. Unset values are shown as clear placeholders, never invented. */
export interface StoreSettings {
  legalName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string; // digits with country code
  address?: string;
  gstin?: string;
  instagram?: string;
  shipping: {
    flatRate?: number;
    freeAbove?: number;
    dispatchTime?: string;
    deliveryTime?: string;
    coverage?: string;
  };
  returnsPolicy?: string;
  privacyPolicy?: string;
  termsText?: string;
  /** Set by the owner once the policy texts have been reviewed; until then public pages show a draft notice. */
  policiesReviewed?: boolean;
  brandStory?: { heading?: string; body?: string };
  /** Real customer quotes entered by the owner (with permission). Section is hidden while empty. */
  testimonials?: { quote: string; name: string; place?: string }[];
  bulk: { minQuantity?: number; responseTime?: string };
  sizeChart?: SizeChart;
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  meta?: Record<string, string | number | boolean | null>;
  ipHash?: string;
}

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  price: number;
  color: string;
  colorHex: string;
  size: Size;
  qty: number;
  art: Product["art"];
  image?: string;
}
