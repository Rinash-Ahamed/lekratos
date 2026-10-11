import { z } from "zod";
import { SIZES } from "./types";

/** Trims, strips control characters, caps length. */
const text = (max: number, min = 0) =>
  z
    .string()
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim())
    .pipe(z.string().min(min).max(max));

const multiline = (max: number) =>
  z
    .string()
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .transform((s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim())
    .pipe(z.string().max(max));

const phone = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().regex(/^\+?[0-9][0-9\s-]{8,16}$/, "Enter a valid phone number"));

const size = z.enum(SIZES as [string, ...string[]]);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);

export const cartLines = z
  .array(
    z.object({
      productId: z.string().min(1).max(80),
      color: text(40, 1),
      size,
      qty: z.coerce.number().int().min(1).max(10),
    }),
  )
  .min(1)
  .max(30);

export const priceBody = z.object({ lines: cartLines, code: text(30).optional() });

export const checkoutBody = z.object({
  lines: cartLines,
  code: text(30).optional(),
  checkoutKey: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
  customer: z.object({ name: text(80, 2), phone, email: z.email().max(120) }),
  address: z.object({
    line1: text(160, 3),
    line2: text(160).optional(),
    city: text(80, 2),
    state: text(80, 2),
    pincode: z.string().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
  }),
});

export const verifyBody = z.object({
  orderId: z.string().max(40),
  token: z.string().max(80),
  razorpay_order_id: z.string().max(60),
  razorpay_payment_id: z.string().max(60),
  razorpay_signature: z.string().max(128),
});

export const trackBody = z.object({ id: text(40, 3), phone });

export const enquiryFields = z.object({
  name: text(80, 2),
  phone,
  email: z.union([z.email().max(120), z.literal("")]).optional(),
  product: text(120),
  quantity: z.coerce.number().int().min(1).max(100000),
  location: text(160, 2),
  notes: multiline(1500),
});

const imageUrl = z
  .string()
  .max(600)
  .refine(
    (u) => u.startsWith("/uploads/") || /^https:\/\/(firebasestorage|storage)\.googleapis\.com\//.test(u),
    "Image must be uploaded through the dashboard",
  );

export const productBody = z.object({
  id: z.string().max(80).optional(),
  name: text(100, 1),
  slug: slug.optional(),
  collection: text(80),
  price: z.coerce.number().int().min(1).max(1_000_000),
  compareAt: z.coerce.number().int().min(1).max(1_000_000).optional().nullable(),
  description: multiline(1200),
  story: multiline(1200),
  fabric: multiline(300).optional(),
  fit: multiline(300).optional(),
  care: multiline(300).optional(),
  colors: z.array(z.object({ name: text(30, 1), hex })).min(1).max(12),
  variants: z.array(z.object({ color: text(30), size, stock: z.coerce.number().int().min(0).max(100000) })).max(200),
  images: z.array(imageUrl).max(12),
  tags: z.array(z.enum(["new", "bestseller", "limited", "trending"])).max(4),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
});

export const collectionsBody = z.array(z.object({ slug: slug.optional(), name: text(60, 1), blurb: text(200) })).max(40);
export const offersBody = z
  .array(
    z.object({
      id: z.string().max(40).optional(),
      code: z.string().transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "")).pipe(z.string().min(3).max(30)),
      label: text(100),
      percent: z.coerce.number().int().min(1).max(90),
      minSubtotal: z.coerce.number().int().min(0).max(1_000_000),
      active: z.boolean(),
    }),
  )
  .max(50);
export const bannersBody = z
  .array(
    z.object({
      id: z.string().max(40).optional(),
      headline: text(80, 1),
      sub: text(160),
      cta: text(40),
      href: z.string().regex(/^\/(?!\/)[A-Za-z0-9/_?=&%.-]*$/, "Link must start with /"),
      image: imageUrl.optional().or(z.literal("")),
      active: z.boolean(),
    }),
  )
  .max(10);

const money = z.coerce.number().int().min(0).max(1_000_000).optional().nullable();
export const settingsBody = z.object({
  legalName: text(120).optional(),
  email: z.union([z.email().max(120), z.literal("")]).optional(),
  phone: text(30).optional(),
  whatsapp: z.string().regex(/^\d{8,15}$/, "Digits only, with country code").optional().or(z.literal("")),
  address: multiline(300).optional(),
  gstin: text(20).optional(),
  instagram: text(60).optional(),
  shipping: z.object({
    flatRate: money,
    freeAbove: money,
    dispatchTime: text(80).optional(),
    deliveryTime: text(80).optional(),
    coverage: text(160).optional(),
  }),
  returnsPolicy: multiline(4000).optional(),
  privacyPolicy: multiline(8000).optional(),
  termsText: multiline(8000).optional(),
  policiesReviewed: z.boolean().optional(),
  testimonials: z.array(z.object({ quote: multiline(400), name: text(60, 1), place: text(60).optional() })).max(6).optional(),
  brandStory: z.object({ heading: text(120).optional(), body: multiline(1500).optional() }).optional(),
  bulk: z.object({ minQuantity: money, responseTime: text(80).optional() }),
  sizeChart: z
    .object({
      unit: z.enum(["in", "cm"]),
      columns: z.array(text(30, 1)).min(1).max(6),
      rows: z.array(z.object({ size, values: z.array(text(20)).max(6) })).max(6),
    })
    .optional()
    .nullable(),
});

export const orderAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fulfil"), status: z.enum(["paid", "packed", "shipped", "delivered"]), trackingNote: text(300).optional() }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("refund"), amount: z.coerce.number().int().min(1).max(1_000_000).optional(), restock: z.boolean(), note: text(200).optional() }),
  z.object({ action: z.literal("note"), adminNote: multiline(500) }),
]);

export const enquiryPatch = z.object({
  id: z.string().max(60),
  status: z.enum(["new", "contacted", "quoted", "closed"]).optional(),
  internalNotes: multiline(2000).optional(),
  followUpAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
});

export type ProductBody = z.infer<typeof productBody>;

/** Parses JSON body with a schema; returns data or a ready 4xx Response. */
export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<{ data: z.infer<T> } | { res: Response }> {
  const raw = await req.json().catch(() => undefined);
  if (raw === undefined) return { res: Response.json({ error: "Invalid request" }, { status: 400 }) };
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return { res: Response.json({ error: `${where}${issue.message}` }, { status: 422 }) };
  }
  return { data: r.data };
}
