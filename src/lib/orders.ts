import "server-only";
import { bustCache } from "./cache";
import { getDb } from "./data";
import type { Tx } from "./data/db";
import { db } from "./db";
import { env } from "./env";
import { gateway, RazorpayError, type RzPayment } from "./razorpay";
import { log } from "./log";
import { newId, randomToken, safeEqual, sha256 } from "./ids";
import type { PriceOk } from "./pricing";
import { PAID_STATUSES, type Order, type OrderItem, type OrderStatus, type Product } from "./types";

/**
 * Order lifecycle & inventory. ALL stock-affecting changes happen inside a database
 * transaction so concurrent buyers can never oversell and webhooks can safely retry.
 *
 *   createPendingOrder ── reserves stock, order = pending (reservedUntil = now + N min)
 *   attachGatewayOrder ── stores the Razorpay order id
 *   markPaid           ── idempotent; only called with gateway-verified payment data
 *   releaseReservation ── pending → expired/failed, stock returned
 *   refundOrder        ── gateway refund, then ledger entry (+ optional restock)
 *   sweepExpired       ── reconcile with the gateway, then release lapsed reservations
 */

export class OrderError extends Error {
  constructor(
    public code: "OUT_OF_STOCK" | "PRICE_CHANGED" | "NOT_FOUND" | "INVALID_STATE" | "FORBIDDEN" | "GATEWAY",
    message: string,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

const MAX_EVENTS = 60;
const MAX_LIFETIME_MS = 2 * 60 * 60 * 1000;

const now = () => new Date().toISOString();
const bustCatalog = () => bustCache("catalog");

function withEvent(o: Order, type: string, note?: string): Order["events"] {
  return [...(o.events ?? []), { at: now(), type, note }].slice(-MAX_EVENTS);
}

const itemKey = (i: Pick<OrderItem, "productId" | "color" | "size">) => `${i.productId}|${i.color}|${i.size}`;

function normalize(o: Order): Order {
  return (o.status as string) === "placed" ? { ...o, status: "pending" } : o;
}

/** Deterministic order id from the checkout idempotency key → atomic de-duplication. */
export function orderIdFromKey(key: string): string {
  const hex = sha256(`checkout:${key}`);
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let s = "";
  for (let i = 0; i < 10; i++) s += ALPHABET[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % 32];
  return `LK-${s}`;
}

/** Reads all affected products (must happen before any write in the tx). */
async function readProducts(tx: Tx, ids: string[]): Promise<Map<string, Product>> {
  const m = new Map<string, Product>();
  for (const id of [...new Set(ids)]) {
    const p = await tx.get<Product>("products", id);
    if (p) m.set(id, p);
  }
  return m;
}

/** Applies stock deltas to the in-memory product docs. Returns the first shortage (if any). */
function applyStock(products: Map<string, Product>, items: OrderItem[], sign: 1 | -1): OrderItem | null {
  for (const it of items) {
    const p = products.get(it.productId);
    const v = p?.variants.find((x) => x.color === it.color && x.size === it.size);
    if (!p || !v) {
      if (sign === -1) return it;
      continue; // product deleted since: nothing to give back to
    }
    if (sign === -1 && v.stock < it.qty) return it;
    v.stock += sign * it.qty;
  }
  return null;
}

/* ------------------------------------------------------------------ create */

export interface CreateInput {
  priced: PriceOk;
  customer: Order["customer"];
  address: Order["address"];
  checkoutKey: string;
}

export async function createPendingOrder(input: CreateInput): Promise<{ order: Order; token: string; reused: boolean }> {
  const { priced, checkoutKey } = input;
  const id = orderIdFromKey(checkoutKey);
  const token = randomToken();
  const reservedUntil = new Date(Date.now() + env.reservationMinutes() * 60_000).toISOString();

  const result = await getDb().tx(async (tx) => {
    const existing = await tx.get<Order>("orders", id);
    const products = await readProducts(tx, priced.items.map((i) => i.productId));

    if (existing) {
      const ex = normalize(existing);
      const same =
        ex.total === priced.total &&
        ex.items.length === priced.items.length &&
        ex.items.every((a) => priced.items.some((b) => itemKey(a) === itemKey(b) && a.qty === b.qty));
      if (!same) throw new OrderError("INVALID_STATE", "Your bag changed. Please review it and try again.");
      if (PAID_STATUSES.includes(ex.status)) throw new OrderError("INVALID_STATE", "This order has already been paid.");
      if (ex.status !== "pending") throw new OrderError("INVALID_STATE", "This checkout has ended. Please start again.");
      // idempotent re-submit: keep the reservation, rotate the access token
      const next: Order = { ...ex, tokenHash: sha256(token), customer: input.customer, address: input.address, updatedAt: now() };
      tx.set("orders", id, next);
      return { order: next, reused: true };
    }

    // authoritative price + stock re-check against the live documents
    for (const it of priced.items) {
      const p = products.get(it.productId);
      if (!p || !p.published) throw new OrderError("OUT_OF_STOCK", `${it.name} is no longer available`);
      if (p.price !== it.price) throw new OrderError("PRICE_CHANGED", `The price of ${p.name} just changed. Please review your bag.`);
    }
    const short = applyStock(products, priced.items, -1);
    if (short) throw new OrderError("OUT_OF_STOCK", `${short.name} (${short.color}, ${short.size}) just sold out`);

    const order: Order = {
      id,
      paid: false,
      status: "pending",
      items: priced.items,
      subtotal: priced.subtotal,
      shipping: priced.shipping,
      discount: priced.discount,
      couponCode: priced.couponCode,
      total: priced.total,
      customer: input.customer,
      address: input.address,
      createdAt: now(),
      updatedAt: now(),
      checkoutKey,
      tokenHash: sha256(token),
      reservedUntil,
      stockReserved: true,
      events: [{ at: now(), type: "created", note: "stock reserved" }],
    };
    for (const p of products.values()) tx.set("products", p.id, p);
    tx.set("orders", id, order);
    return { order, reused: false };
  });

  bustCatalog();
  return { ...result, token };
}

/** Stores the gateway order id. No-op unless the order is still pending. */
export async function attachGatewayOrder(orderId: string, razorpayOrderId: string): Promise<Order> {
  return getDb().tx(async (tx) => {
    const o = await tx.get<Order>("orders", orderId);
    if (!o) throw new OrderError("NOT_FOUND", "Order not found");
    const ex = normalize(o);
    if (ex.status !== "pending") return ex;
    const next: Order = { ...ex, razorpayOrderId, updatedAt: now(), events: withEvent(ex, "gateway_order", razorpayOrderId) };
    tx.set("orders", orderId, next);
    return next;
  });
}

/* --------------------------------------------------------------- payments */

export type PaidOutcome = "paid" | "already_paid" | "review" | "duplicate_payment";

export interface VerifiedPayment {
  id: string;
  amountPaise: number;
  currency: string;
  method?: string;
}

/**
 * Marks an order paid. Idempotent. Callers MUST have validated the payment with the gateway
 * (see confirmWithGateway) – this function re-checks amount/currency as a last line of defence.
 */
export async function markPaid(orderId: string, pay: VerifiedPayment): Promise<{ order: Order; outcome: PaidOutcome }> {
  const out = await getDb().tx(async (tx) => {
    const raw = await tx.get<Order>("orders", orderId);
    if (!raw) throw new OrderError("NOT_FOUND", "Order not found");
    const o = normalize(raw);

    if (pay.currency !== "INR" || pay.amountPaise !== o.total * 100)
      throw new OrderError("INVALID_STATE", "Payment amount does not match the order");

    // already settled
    if (PAID_STATUSES.includes(o.status) || o.status === "refunded" || o.status === "review") {
      if (o.razorpayPaymentId && o.razorpayPaymentId !== pay.id) {
        const known = (o.extraPayments ?? []).some((p) => p.id === pay.id);
        if (known) return { order: o, outcome: "already_paid" as PaidOutcome };
        const next: Order = {
          ...o,
          extraPayments: [...(o.extraPayments ?? []), { id: pay.id, amountPaise: pay.amountPaise }],
          events: withEvent(o, "duplicate_payment", pay.id),
          updatedAt: now(),
        };
        tx.set("orders", orderId, next);
        return { order: next, outcome: "duplicate_payment" as PaidOutcome };
      }
      return { order: o, outcome: "already_paid" as PaidOutcome };
    }

    const base: Order = {
      ...o,
      paid: true,
      razorpayPaymentId: pay.id,
      payment: { amountPaise: pay.amountPaise, currency: pay.currency, method: pay.method, capturedAt: now() },
    };

    if (o.status === "pending") {
      const next: Order = { ...base, status: "paid", events: withEvent(o, "paid", pay.id), updatedAt: now() };
      tx.set("orders", orderId, next);
      return { order: next, outcome: "paid" as PaidOutcome };
    }

    // expired / failed / cancelled: stock was released – try to take it back
    const products = await readProducts(tx, o.items.map((i) => i.productId));
    const short = applyStock(products, o.items, -1);
    if (short || o.status === "cancelled") {
      const next: Order = {
        ...base,
        status: "review",
        events: withEvent(o, "paid_needs_review", short ? `stock unavailable for ${short.name}` : "order was cancelled"),
        updatedAt: now(),
      };
      tx.set("orders", orderId, next);
      return { order: next, outcome: "review" as PaidOutcome };
    }
    const next: Order = { ...base, status: "paid", stockReserved: true, events: withEvent(o, "paid_after_expiry", "stock re-reserved"), updatedAt: now() };
    for (const p of products.values()) tx.set("products", p.id, p);
    tx.set("orders", orderId, next);
    return { order: next, outcome: "paid" as PaidOutcome };
  });

  if (out.outcome === "paid" || out.outcome === "review") bustCatalog();
  if (out.outcome === "duplicate_payment") void autoRefundDuplicate(out.order, pay);
  return out;
}

async function autoRefundDuplicate(order: Order, pay: VerifiedPayment) {
  try {
    const r = await gateway.refund(pay.id, { amountPaise: pay.amountPaise, note: `Duplicate payment for ${order.id}` });
    await getDb().tx(async (tx) => {
      const o = await tx.get<Order>("orders", order.id);
      if (!o) return;
      const extra = (o.extraPayments ?? []).map((p) => (p.id === pay.id ? { ...p, refundId: r.id } : p));
      tx.set("orders", order.id, { ...o, extraPayments: extra, events: withEvent(o, "duplicate_refunded", r.id), updatedAt: now() });
    });
  } catch (e) {
    log.error("duplicate payment auto-refund failed", e, { orderId: order.id });
  }
}

/**
 * Asks the gateway for the payment's real state and validates it against OUR order.
 * Never trusts client-supplied status or amounts.
 */
export type GatewayCheck =
  | { state: "captured"; payment: VerifiedPayment }
  | { state: "pending" } // authorized/created – webhook will finalise
  | { state: "failed"; reason?: string };

export async function checkPaymentWithGateway(order: Order, paymentId: string): Promise<GatewayCheck> {
  const p: RzPayment = await gateway.fetchPayment(paymentId);
  if (!order.razorpayOrderId || p.order_id !== order.razorpayOrderId) throw new OrderError("INVALID_STATE", "Payment does not belong to this order");
  if (p.currency !== "INR" || p.amount !== order.total * 100) throw new OrderError("INVALID_STATE", "Payment amount does not match the order");
  if (p.status === "captured") return { state: "captured", payment: { id: p.id, amountPaise: p.amount, currency: p.currency, method: p.method } };
  if (p.status === "failed") return { state: "failed", reason: p.error_description ?? undefined };
  return { state: "pending" };
}

export async function recordAttemptFailure(orderId: string, note?: string) {
  await getDb().tx(async (tx) => {
    const o = await tx.get<Order>("orders", orderId);
    if (!o) return;
    const ex = normalize(o);
    if (ex.status !== "pending") return;
    tx.set("orders", orderId, { ...ex, events: withEvent(ex, "payment_attempt_failed", note?.slice(0, 120)), updatedAt: now() });
  });
}

/* ----------------------------------------------------- release / expiry */

export async function releaseReservation(orderId: string, to: "expired" | "failed" | "cancelled", note?: string): Promise<Order> {
  const out = await getDb().tx(async (tx) => {
    const raw = await tx.get<Order>("orders", orderId);
    if (!raw) throw new OrderError("NOT_FOUND", "Order not found");
    const o = normalize(raw);
    if (o.status !== "pending") return { order: o, released: false }; // paid in the meantime, or already released
    const products = o.stockReserved ? await readProducts(tx, o.items.map((i) => i.productId)) : new Map<string, Product>();
    if (o.stockReserved) applyStock(products, o.items, 1);
    const next: Order = { ...o, status: to, stockReserved: false, events: withEvent(o, to, note), updatedAt: now() };
    for (const p of products.values()) tx.set("products", p.id, p);
    tx.set("orders", orderId, next);
    return { order: next, released: true };
  });
  if (out.released) bustCatalog();
  return out.order;
}

/**
 * Reconciles ONE lapsed pending order: if the gateway shows a captured payment we settle it,
 * otherwise the stock is released. Gateway errors leave the order untouched (retried next sweep).
 */
export async function reconcileExpired(o: Order): Promise<"paid" | "released" | "skipped"> {
  try {
    if (o.razorpayOrderId && env.razorpay()) {
      const payments = await gateway.fetchOrderPayments(o.razorpayOrderId);
      const cap = payments.find((p) => p.status === "captured" && p.amount === o.total * 100 && p.currency === "INR");
      if (cap) {
        await markPaid(o.id, { id: cap.id, amountPaise: cap.amount, currency: cap.currency, method: cap.method });
        return "paid";
      }
    }
    await releaseReservation(o.id, "expired", "reservation lapsed");
    return "released";
  } catch (e) {
    log.warn("reconcile skipped", { orderId: o.id, err: e instanceof Error ? e.name : "error" });
    return "skipped";
  }
}

export async function sweepExpired(): Promise<{ released: number; paid: number }> {
  let released = 0;
  let paid = 0;
  for (const o of await db.orders.expiredPending(now())) {
    const r = await reconcileExpired(o);
    if (r === "paid") paid++;
    if (r === "released") released++;
  }
  return { released, paid };
}

/* ----------------------------------------------------- customer access */

export function tokenMatches(order: Order, token: string | null | undefined): boolean {
  return !!token && !!order.tokenHash && safeEqual(sha256(token), order.tokenHash);
}

/**
 * Customer retry: reuse the live gateway order while reserved, otherwise try to
 * re-reserve stock and open a fresh gateway order. Extends the hold (bounded).
 */
export async function reopenForPayment(orderId: string): Promise<{ order: Order; needsGatewayOrder: boolean }> {
  const reservedUntil = new Date(Date.now() + env.reservationMinutes() * 60_000).toISOString();
  const out = await getDb().tx(async (tx) => {
    const raw = await tx.get<Order>("orders", orderId);
    if (!raw) throw new OrderError("NOT_FOUND", "Order not found");
    const o = normalize(raw);
    if (PAID_STATUSES.includes(o.status) || o.status === "review" || o.status === "refunded") throw new OrderError("INVALID_STATE", "This order has already been paid.");
    if (o.status === "cancelled") throw new OrderError("INVALID_STATE", "This order was cancelled.");
    if (Date.now() - new Date(o.createdAt).getTime() > MAX_LIFETIME_MS) throw new OrderError("INVALID_STATE", "This checkout is too old. Please start again.");

    if (o.status === "pending") {
      const next: Order = { ...o, reservedUntil, events: withEvent(o, "hold_extended"), updatedAt: now() };
      tx.set("orders", orderId, next);
      return { order: next, needsGatewayOrder: !o.razorpayOrderId };
    }
    // expired / failed → re-reserve
    const products = await readProducts(tx, o.items.map((i) => i.productId));
    const short = applyStock(products, o.items, -1);
    if (short) throw new OrderError("OUT_OF_STOCK", `${short.name} (${short.color}, ${short.size}) is no longer available`);
    const next: Order = {
      ...o,
      status: "pending",
      stockReserved: true,
      reservedUntil,
      razorpayOrderId: undefined, // a fresh gateway order is created for the new attempt
      events: withEvent(o, "reopened", "stock re-reserved"),
      updatedAt: now(),
    };
    for (const p of products.values()) tx.set("products", p.id, p);
    tx.set("orders", orderId, next);
    return { order: next, needsGatewayOrder: true };
  });
  bustCatalog();
  return out;
}

/** Creates the gateway order for a pending order. On failure the reservation is released. */
export async function openGatewayOrder(order: Order): Promise<Order> {
  try {
    const rz = await gateway.createOrder({
      amountPaise: order.total * 100,
      receipt: `${order.id}-${Date.now().toString(36)}`.slice(0, 40),
      notes: { orderId: order.id },
    });
    return await attachGatewayOrder(order.id, rz.id);
  } catch (e) {
    await releaseReservation(order.id, "failed", e instanceof RazorpayError ? e.code : "gateway");
    throw e;
  }
}

/* ------------------------------------------------------------- admin ops */

const FULFIL: OrderStatus[] = ["paid", "packed", "shipped", "delivered"];

export async function setFulfilment(orderId: string, status: OrderStatus, by: string, trackingNote?: string): Promise<Order> {
  return getDb().tx(async (tx) => {
    const raw = await tx.get<Order>("orders", orderId);
    if (!raw) throw new OrderError("NOT_FOUND", "Order not found");
    const o = normalize(raw);
    if (!FULFIL.includes(status)) throw new OrderError("INVALID_STATE", "Use the cancel / refund actions for that change");
    if (!FULFIL.includes(o.status)) throw new OrderError("INVALID_STATE", `A ${o.status} order can't be moved to ${status}`);
    const next: Order = {
      ...o,
      status,
      trackingNote: trackingNote !== undefined ? trackingNote.slice(0, 300) : o.trackingNote,
      events: withEvent(o, `status:${status}`, by),
      updatedAt: now(),
    };
    tx.set("orders", orderId, next);
    return next;
  });
}

export async function cancelUnpaid(orderId: string, by: string): Promise<Order> {
  const o = await db.orders.byId(orderId);
  if (!o) throw new OrderError("NOT_FOUND", "Order not found");
  if (o.status !== "pending") throw new OrderError("INVALID_STATE", "Only unpaid orders can be cancelled here. Paid orders are cancelled by refunding them.");
  return releaseReservation(orderId, "cancelled", `by ${by}`);
}

export async function refundOrder(
  orderId: string,
  p: { amountRupees?: number; restock: boolean; by: string; note?: string },
): Promise<Order> {
  const o = await db.orders.byId(orderId);
  if (!o) throw new OrderError("NOT_FOUND", "Order not found");
  if (!o.razorpayPaymentId || !(PAID_STATUSES.includes(o.status) || o.status === "review"))
    throw new OrderError("INVALID_STATE", "Only paid orders can be refunded");
  const remaining = o.total - (o.refundedTotal ?? 0);
  const amount = Math.floor(p.amountRupees ?? remaining);
  if (!(amount >= 1) || amount > remaining) throw new OrderError("INVALID_STATE", `Refund must be between ₹1 and ₹${remaining}`);
  const full = amount === remaining && !(o.refundedTotal ?? 0);
  const restock = p.restock && full; // restock only for a single full refund (no partial stock arithmetic)

  let rzRefundId: string;
  try {
    rzRefundId = (await gateway.refund(o.razorpayPaymentId, { amountPaise: amount * 100, note: p.note })).id;
  } catch (e) {
    throw new OrderError("GATEWAY", e instanceof RazorpayError ? e.message : "The gateway rejected the refund");
  }
  return recordRefund(orderId, { id: rzRefundId, amount, by: p.by, note: p.note, restock });
}

/** Ledger entry (+ optional restock). Idempotent on refund id (webhook may deliver the same refund). */
export async function recordRefund(orderId: string, r: { id: string; amount: number; by: string; note?: string; restock: boolean }): Promise<Order> {
  const out = await getDb().tx(async (tx) => {
    const raw = await tx.get<Order>("orders", orderId);
    if (!raw) throw new OrderError("NOT_FOUND", "Order not found");
    const o = normalize(raw);
    if ((o.refunds ?? []).some((x) => x.id === r.id)) return { order: o, restocked: false };
    const products = r.restock ? await readProducts(tx, o.items.map((i) => i.productId)) : new Map<string, Product>();
    if (r.restock) applyStock(products, o.items, 1);
    const refundedTotal = (o.refundedTotal ?? 0) + r.amount;
    const next: Order = {
      ...o,
      refunds: [...(o.refunds ?? []), { id: r.id, amount: r.amount, at: now(), by: r.by, note: r.note, restocked: r.restock }],
      refundedTotal,
      status: refundedTotal >= o.total ? "refunded" : o.status,
      events: withEvent(o, "refund", `₹${r.amount}${r.restock ? " +restock" : ""}`),
      updatedAt: now(),
    };
    for (const p of products.values()) tx.set("products", p.id, p);
    tx.set("orders", orderId, next);
    return { order: next, restocked: r.restock };
  });
  if (out.restocked) bustCatalog();
  return out.order;
}

/** What a customer holding the order token may see. */
export function publicOrderView(o: Order) {
  return {
    id: o.id,
    status: o.status,
    paid: o.paid,
    total: o.total,
    subtotal: o.subtotal,
    shipping: o.shipping,
    discount: o.discount,
    items: o.items,
    createdAt: o.createdAt,
    reservedUntil: o.reservedUntil,
    trackingNote: o.trackingNote,
    retryable: o.status === "pending" || o.status === "expired" || o.status === "failed",
  };
}

export { newId };
