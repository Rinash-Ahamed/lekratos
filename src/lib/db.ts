import "server-only";
import { getDb } from "./data";
import { sha256 } from "./ids";
import type { AuditLog, Banner, Collection, Enquiry, Offer, Order, Product, StoreSettings } from "./types";

/**
 * Repository facade over the active database adapter (Firestore in production, JSON locally).
 * Collection layout (document id in brackets):
 *   products[id]  collections[slug]  orders[id]  enquiries[id]  offers[id]  banners[id]
 *   subscribers[sha256(email)]  settings["store"]  auditLogs[id]  rateLimits[key:window]
 *   webhookEvents[event id]  adminSessions[sid]
 */

export const DEFAULT_SETTINGS: StoreSettings = { shipping: {}, bulk: {} };

/** v1 rows used "placed" for "awaiting payment". */
function normalizeOrder(o: Order): Order {
  const legacy = (o.status as string) === "placed" ? "pending" : o.status;
  return { ...o, status: legacy };
}

const byCreatedDesc = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

async function replaceAll<T extends object>(
  col: "collections" | "offers" | "banners",
  rows: T[],
  idOf: (r: T) => string,
) {
  const db = getDb();
  const existing = await db.list<Record<string, unknown>>(col);
  const keep = new Set(rows.map(idOf));
  const idField = col === "collections" ? "slug" : "id";
  for (const e of existing) {
    const id = String(e[idField]);
    if (!keep.has(id)) await db.delete(col, id);
  }
  for (const [i, r] of rows.entries()) await db.set(col, idOf(r), { ...r, order: i });
}

export const db = {
  products: {
    all: async () => (await getDb().list<Product>("products")).sort(byCreatedDesc),
    published: async () =>
      (await getDb().list<Product>("products", { where: [{ field: "published", op: "==", value: true }] })).sort(byCreatedDesc),
    byId: (id: string) => getDb().get<Product>("products", id),
    bySlug: async (slug: string) =>
      (await getDb().list<Product>("products", { where: [{ field: "slug", op: "==", value: slug }], limit: 1 }))[0],
    save: async (p: Product) => {
      const next = { ...p, updatedAt: new Date().toISOString() };
      await getDb().set("products", p.id, next);
      return next;
    },
    remove: (id: string) => getDb().delete("products", id),
  },

  collections: {
    all: async () =>
      (await getDb().list<Collection & { order?: number }>("collections")).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)),
    writeAll: (rows: Collection[]) => replaceAll("collections", rows, (r) => r.slug),
  },

  orders: {
    all: async (limit = 500) =>
      (await getDb().list<Order>("orders", { orderBy: { field: "createdAt", dir: "desc" }, limit })).map(normalizeOrder),
    byId: async (id: string) => {
      const o = await getDb().get<Order>("orders", id);
      return o ? normalizeOrder(o) : undefined;
    },
    byRazorpayId: async (rid: string) => {
      const o = (await getDb().list<Order>("orders", { where: [{ field: "razorpayOrderId", op: "==", value: rid }], limit: 1 }))[0];
      return o ? normalizeOrder(o) : undefined;
    },
    byRazorpayPaymentId: async (pid: string) => {
      const o = (await getDb().list<Order>("orders", { where: [{ field: "razorpayPaymentId", op: "==", value: pid }], limit: 1 }))[0];
      return o ? normalizeOrder(o) : undefined;
    },
    byCheckoutKey: async (key: string) => {
      const o = (await getDb().list<Order>("orders", { where: [{ field: "checkoutKey", op: "==", value: key }], limit: 1 }))[0];
      return o ? normalizeOrder(o) : undefined;
    },
    /** Pending orders whose reservation window has lapsed (needs composite index status+reservedUntil). */
    expiredPending: async (nowIso: string) =>
      (
        await getDb().list<Order>("orders", {
          where: [
            { field: "status", op: "==", value: "pending" },
            { field: "reservedUntil", op: "<", value: nowIso },
          ],
          limit: 50,
        })
      ).map(normalizeOrder),
    /** Plain write for non-inventory fields. Stock-affecting transitions live in lib/orders.ts (transactional). */
    save: async (o: Order) => {
      const next = { ...o, updatedAt: new Date().toISOString() };
      await getDb().set("orders", o.id, next);
      return next;
    },
  },

  enquiries: {
    all: async (limit = 500) =>
      (await getDb().list<Enquiry>("enquiries", { orderBy: { field: "createdAt", dir: "desc" }, limit })),
    byId: (id: string) => getDb().get<Enquiry>("enquiries", id),
    save: async (e: Enquiry) => {
      const next = { ...e, updatedAt: new Date().toISOString() };
      await getDb().set("enquiries", e.id, next);
      return next;
    },
  },

  offers: {
    all: async () => (await getDb().list<Offer & { order?: number }>("offers")).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)),
    writeAll: (rows: Offer[]) => replaceAll("offers", rows, (r) => r.id),
  },

  banners: {
    all: async () => (await getDb().list<Banner & { order?: number }>("banners")).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)),
    writeAll: (rows: Banner[]) => replaceAll("banners", rows, (r) => r.id),
  },

  settings: {
    get: async (): Promise<StoreSettings> => {
      const s = await getDb().get<StoreSettings>("settings", "store");
      return { ...DEFAULT_SETTINGS, ...s, shipping: { ...s?.shipping }, bulk: { ...s?.bulk } };
    },
    save: async (s: StoreSettings) => {
      await getDb().set("settings", "store", s);
      return s;
    },
  },

  subscribers: {
    add: async (email: string) => {
      await getDb().create("subscribers", sha256(email), { email, at: new Date().toISOString() });
    },
  },

  audit: {
    add: (row: AuditLog) => getDb().set("auditLogs", row.id, row),
    recent: (limit = 100) => getDb().list<AuditLog>("auditLogs", { orderBy: { field: "at", dir: "desc" }, limit }),
  },
};
