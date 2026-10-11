import { bustCache } from "@/lib/cache";
import { isAdminCtx, requireAdmin, type AdminCtx } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { readiness } from "@/lib/readiness";
import { bannersBody, collectionsBody, enquiryPatch, offersBody, parseJson, productBody, settingsBody } from "@/lib/schemas";
import { sweepExpired } from "@/lib/orders";
import { PAID_STATUSES, SIZES, type Product, type Variant } from "@/lib/types";

type Ctx = { params: Promise<{ resource: string }> };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product";
const bust = bustCache;
const bad = (msg: string, status = 422) => Response.json({ error: msg }, { status });

async function analytics() {
  const orders = (await db.orders.all(5000)).filter((o) => PAID_STATUSES.includes(o.status));
  const net = (o: { total: number; refundedTotal?: number }) => o.total - (o.refundedTotal ?? 0);
  const revenue = orders.reduce((n, o) => n + net(o), 0);
  const units = orders.reduce((n, o) => n + o.items.reduce((m, i) => m + i.qty, 0), 0);
  const byProduct = new Map<string, { name: string; units: number; revenue: number }>();
  for (const o of orders)
    for (const i of o.items) {
      const r = byProduct.get(i.productId) ?? { name: i.name, units: 0, revenue: 0 };
      r.units += i.qty;
      r.revenue += i.qty * i.price;
      byProduct.set(i.productId, r);
    }
  const days: Record<string, number> = {};
  for (let d = 13; d >= 0; d--) days[new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)] = 0;
  for (const o of orders) {
    const k = o.createdAt.slice(0, 10);
    if (k in days) days[k] += net(o);
  }
  const all = await db.orders.all(5000);
  const products = await db.products.all();
  return {
    revenue,
    orders: orders.length,
    units,
    aov: orders.length ? Math.round(revenue / orders.length) : 0,
    top: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    daily: Object.entries(days).map(([date, total]) => ({ date, total })),
    lowStock: products.flatMap((p) =>
      p.variants.filter((v) => v.stock <= 2 && p.published).map((v) => ({ name: p.name, color: v.color, size: v.size, stock: v.stock })),
    ).filter((v) => v.stock > 0).slice(0, 30),
    soldOutVariants: products.reduce((n, p) => n + (p.published ? p.variants.filter((v) => v.stock === 0).length : 0), 0),
    newEnquiries: (await db.enquiries.all(500)).filter((e) => e.status === "new").length,
    needsAttention: all.filter((o) => o.status === "review" || (o.extraPayments ?? []).some((x) => !x.refundId)).length,
    pending: all.filter((o) => o.status === "pending").length,
  };
}

export async function GET(req: Request, { params }: Ctx) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const { resource } = await params;
  const noStore = { headers: { "Cache-Control": "private, no-store" } };
  switch (resource) {
    case "products": return Response.json(await db.products.all(), noStore);
    case "collections": return Response.json(await db.collections.all(), noStore);
    case "orders":
      await sweepExpired().catch(() => undefined); // keep the list truthful
      return Response.json(await db.orders.all(), noStore);
    case "enquiries": return Response.json(await db.enquiries.all(), noStore);
    case "offers": return Response.json(await db.offers.all(), noStore);
    case "banners": return Response.json(await db.banners.all(), noStore);
    case "settings": return Response.json(await db.settings.get(), noStore);
    case "audit": return Response.json(await db.audit.recent(150), noStore);
    case "analytics": return Response.json(await analytics(), noStore);
    case "readiness": return Response.json(await readiness(), noStore);
    default: return bad("Not found", 404);
  }
}

async function saveProduct(ctx: AdminCtx, req: Request) {
  const p = await parseJson(req, productBody);
  if ("res" in p) return p.res;
  const b = p.data;
  const existing = b.id ? await db.products.byId(b.id) : undefined;
  if (b.id && !existing) return bad("Product not found", 404);

  // one variant per colour × size so stock grids are always complete; only known colours kept
  const names = new Set(b.colors.map((c) => c.name));
  if (names.size !== b.colors.length) return bad("Colour names must be unique");
  const variants: Variant[] = b.colors.flatMap((c) =>
    SIZES.map((size) => ({ color: c.name, size, stock: b.variants.find((v) => v.color === c.name && v.size === size)?.stock ?? 0 })),
  );

  const all = await db.products.all();
  let slug = existing?.slug ?? slugify(b.slug ?? b.name);
  if (all.some((x) => x.slug === slug && x.id !== existing?.id)) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

  const product: Product = {
    id: existing?.id ?? newId("P"),
    slug,
    name: b.name,
    collection: b.collection,
    price: b.price,
    compareAt: b.compareAt ?? undefined,
    description: b.description,
    story: b.story,
    fabric: b.fabric || undefined,
    fit: b.fit || undefined,
    care: b.care || undefined,
    colors: b.colors,
    variants,
    images: b.images,
    art: existing?.art ?? { kind: "stripe", seed: Math.floor(Math.random() * 1000) },
    tags: b.tags,
    featured: b.featured ?? false,
    sample: existing?.sample,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    published: b.published !== false,
  };
  const saved = await db.products.save(product);
  await audit(ctx, existing ? "product.update" : "product.create", saved.id, { name: saved.name, published: saved.published });
  bust("catalog");
  return Response.json(saved);
}

/** POST: create/update a product, or replace a whole small list (collections, offers, banners) / settings. */
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const { resource } = await params;

  switch (resource) {
    case "products":
      return saveProduct(ctx, req);
    case "collections": {
      const p = await parseJson(req, collectionsBody);
      if ("res" in p) return p.res;
      const rows = p.data.map((c) => ({ slug: c.slug ?? slugify(c.name), name: c.name, blurb: c.blurb }));
      if (new Set(rows.map((r) => r.slug)).size !== rows.length) return bad("Collection names must be unique");
      await db.collections.writeAll(rows);
      await audit(ctx, "collections.update", undefined, { count: rows.length });
      bust("catalog");
      return Response.json(await db.collections.all());
    }
    case "offers": {
      const p = await parseJson(req, offersBody);
      if ("res" in p) return p.res;
      const rows = p.data.map((o) => ({ ...o, id: o.id || newId("OFF", 6) }));
      if (new Set(rows.map((r) => r.code)).size !== rows.length) return bad("Offer codes must be unique");
      await db.offers.writeAll(rows);
      await audit(ctx, "offers.update", undefined, { count: rows.length });
      return Response.json(await db.offers.all());
    }
    case "banners": {
      const p = await parseJson(req, bannersBody);
      if ("res" in p) return p.res;
      const rows = p.data.map((b) => ({ ...b, id: b.id || newId("BAN", 6), image: b.image || undefined }));
      await db.banners.writeAll(rows);
      await audit(ctx, "banners.update", undefined, { count: rows.length });
      bust("catalog");
      return Response.json(await db.banners.all());
    }
    case "settings": {
      const p = await parseJson(req, settingsBody);
      if ("res" in p) return p.res;
      const d = p.data;
      const clean = JSON.parse(JSON.stringify(d, (_k, v) => (v === "" || v === null ? undefined : v)));
      clean.shipping = clean.shipping ?? {};
      clean.bulk = clean.bulk ?? {};
      await db.settings.save(clean);
      await audit(ctx, "settings.update");
      bust("settings", "catalog");
      return Response.json(await db.settings.get());
    }
    default:
      return bad("Not found", 404);
  }
}

/** PATCH: enquiry status / internal notes / follow-up date. */
export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const { resource } = await params;
  if (resource !== "enquiries") return bad("Not found", 404);
  const p = await parseJson(req, enquiryPatch);
  if ("res" in p) return p.res;
  const e = await db.enquiries.byId(p.data.id);
  if (!e) return bad("Not found", 404);
  const next = {
    ...e,
    status: p.data.status ?? e.status,
    internalNotes: p.data.internalNotes ?? e.internalNotes,
    followUpAt: p.data.followUpAt === undefined ? e.followUpAt : p.data.followUpAt || undefined,
  };
  const saved = await db.enquiries.save(next);
  await audit(ctx, "enquiry.update", e.id, { status: saved.status });
  return Response.json(saved);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const ctx = await requireAdmin(req);
  if (!isAdminCtx(ctx)) return ctx;
  const { resource } = await params;
  const id = new URL(req.url).searchParams.get("id");
  if (resource === "products" && id) {
    const p = await db.products.byId(id);
    if (!p) return bad("Not found", 404);
    await db.products.remove(id);
    await audit(ctx, "product.delete", id, { name: p.name });
    bust("catalog");
    return Response.json({ ok: true });
  }
  return bad("Not found", 404);
}
