import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  OrderError, cancelUnpaid, checkPaymentWithGateway, createPendingOrder, markPaid, openGatewayOrder, publicOrderView, recordRefund,
  refundOrder, reopenForPayment, releaseReservation, setFulfilment, sweepExpired, tokenMatches,
} from "@/lib/orders";
import type { FakeRazorpay } from "../support/fake-razorpay";
import { address, customer, freshDb, key, price, seedProduct, startFakeGateway, stockOf } from "../support/helpers";

let fake: FakeRazorpay;
beforeAll(async () => {
  fake = await startFakeGateway();
});
afterAll(() => fake.stop());
beforeEach(async () => {
  freshDb();
  fake.orders.clear();
  fake.payments.clear();
  fake.refunds.length = 0;
  fake.calls.length = 0;
  await seedProduct({ id: "p1", price: 1000, stock: { M: 5, L: 1 } });
});

async function place(qty = 2, k = key(1), size: "M" | "L" = "M") {
  const priced = await price([{ productId: "p1", size, qty }]);
  return createPendingOrder({ priced, customer, address, checkoutKey: k });
}
async function placeWithGateway(qty = 2, k = key(1)) {
  const { order, token } = await place(qty, k);
  const ready = await openGatewayOrder(order);
  return { order: ready, token };
}
const capture = (rzOrderId: string, over = {}) => {
  const p = fake.createPayment(rzOrderId, over);
  return { id: p.id, amountPaise: p.amount, currency: p.currency, method: p.method };
};

describe("stock reservation", () => {
  it("reserves stock at order creation and returns it on release", async () => {
    const { order } = await place(2);
    expect(order.status).toBe("pending");
    expect(order.stockReserved).toBe(true);
    expect(await stockOf("p1", "M")).toBe(3);
    await releaseReservation(order.id, "cancelled");
    expect(await stockOf("p1", "M")).toBe(5);
  });

  it("the same checkout key maps to ONE order and reserves stock once", async () => {
    const a = await place(2, key(7));
    const b = await place(2, key(7));
    expect(b.reused).toBe(true);
    expect(b.order.id).toBe(a.order.id);
    expect(await stockOf("p1", "M")).toBe(3);
    expect(tokenMatches(b.order, a.token)).toBe(false); // token rotated on re-submit
    expect(tokenMatches(b.order, b.token)).toBe(true);
  });

  it("rejects re-using a checkout key with a different bag", async () => {
    await place(2, key(8));
    await expect(place(3, key(8))).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("two buyers racing for the last unit: exactly one wins, stock never goes negative", async () => {
    const results = await Promise.allSettled([place(1, key(10), "L"), place(1, key(11), "L")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason).toBeInstanceOf(OrderError);
    expect(lost.reason.code).toBe("OUT_OF_STOCK");
    expect(await stockOf("p1", "L")).toBe(0);
  });

  it("20 concurrent buyers of 1 unit each against 5 in stock → 5 orders, 0 left", async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => place(1, key(100 + i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(await stockOf("p1", "M")).toBe(0);
  });

  it("refuses when the price changed between pricing and reservation", async () => {
    const priced = await price([{ productId: "p1", size: "M", qty: 1 }]);
    const p = (await db.products.byId("p1"))!;
    await db.products.save({ ...p, price: 1200 });
    await expect(createPendingOrder({ priced, customer, address, checkoutKey: key(20) })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    expect(await stockOf("p1", "M")).toBe(5);
  });
});

describe("payment confirmation", () => {
  it("markPaid is idempotent and never changes stock again", async () => {
    const { order } = await placeWithGateway(2);
    const pay = capture(order.razorpayOrderId!);
    const first = await markPaid(order.id, pay);
    const second = await markPaid(order.id, pay);
    expect(first.outcome).toBe("paid");
    expect(second.outcome).toBe("already_paid");
    expect((await db.orders.byId(order.id))!.status).toBe("paid");
    expect(await stockOf("p1", "M")).toBe(3);
  });

  it("concurrent markPaid calls (browser verify + webhook) settle exactly once", async () => {
    const { order } = await placeWithGateway(1);
    const pay = capture(order.razorpayOrderId!);
    const outs = await Promise.all([markPaid(order.id, pay), markPaid(order.id, pay), markPaid(order.id, pay)]);
    expect(outs.filter((o) => o.outcome === "paid")).toHaveLength(1);
    const o = (await db.orders.byId(order.id))!;
    expect(o.events!.filter((e) => e.type === "paid")).toHaveLength(1);
  });

  it("rejects a payment whose amount or currency does not match the order", async () => {
    const { order } = await placeWithGateway(2);
    const pay = capture(order.razorpayOrderId!);
    await expect(markPaid(order.id, { ...pay, amountPaise: pay.amountPaise - 100 })).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(markPaid(order.id, { ...pay, currency: "USD" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect((await db.orders.byId(order.id))!.paid).toBe(false);
  });

  it("a second, different payment on a paid order is flagged and automatically refunded", async () => {
    const { order } = await placeWithGateway(1);
    await markPaid(order.id, capture(order.razorpayOrderId!));
    const dup = capture(order.razorpayOrderId!);
    const r = await markPaid(order.id, dup);
    expect(r.outcome).toBe("duplicate_payment");
    await vi.waitFor(() => expect(fake.refunds.some((x) => x.payment_id === dup.id)).toBe(true));
    await vi.waitFor(async () => expect((await db.orders.byId(order.id))!.extraPayments![0].refundId).toBeTruthy());
  });

  it("payment captured AFTER the hold expired re-reserves the stock and pays the order", async () => {
    const { order } = await placeWithGateway(2);
    await releaseReservation(order.id, "expired");
    expect(await stockOf("p1", "M")).toBe(5);
    const r = await markPaid(order.id, capture(order.razorpayOrderId!));
    expect(r.outcome).toBe("paid");
    expect(await stockOf("p1", "M")).toBe(3);
  });

  it("payment captured after expiry when the stock is gone → order goes to REVIEW (money is never lost silently)", async () => {
    const { order } = await placeWithGateway(2);
    await releaseReservation(order.id, "expired");
    const other = await place(5, key(30)); // someone else takes all 5
    expect(other.order.status).toBe("pending");
    const r = await markPaid(order.id, capture(order.razorpayOrderId!));
    expect(r.outcome).toBe("review");
    const o = (await db.orders.byId(order.id))!;
    expect(o.status).toBe("review");
    expect(o.paid).toBe(true);
    expect(await stockOf("p1", "M")).toBe(0);
  });
});

describe("gateway verification", () => {
  it("accepts a captured payment that belongs to the order", async () => {
    const { order } = await placeWithGateway(1);
    const p = fake.createPayment(order.razorpayOrderId!);
    expect(await checkPaymentWithGateway(order, p.id)).toMatchObject({ state: "captured" });
  });

  it("rejects a payment that belongs to a different gateway order", async () => {
    const a = await placeWithGateway(1, key(40));
    const b = await placeWithGateway(1, key(41));
    const p = fake.createPayment(b.order.razorpayOrderId!);
    await expect(checkPaymentWithGateway(a.order, p.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("rejects a payment for the wrong amount", async () => {
    const { order } = await placeWithGateway(2);
    const p = fake.createPayment(order.razorpayOrderId!, { amount: 100 });
    await expect(checkPaymentWithGateway(order, p.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("authorized (not captured) → pending; failed → failed", async () => {
    const { order } = await placeWithGateway(1);
    const a = fake.createPayment(order.razorpayOrderId!, { status: "authorized" });
    const f = fake.createPayment(order.razorpayOrderId!, { status: "failed", error_description: "declined" });
    expect(await checkPaymentWithGateway(order, a.id)).toEqual({ state: "pending" });
    expect(await checkPaymentWithGateway(order, f.id)).toMatchObject({ state: "failed" });
  });

  it("a gateway failure when opening the order releases the reservation", async () => {
    const { order } = await place(2);
    fake.failNext = "/v1/orders";
    await expect(openGatewayOrder(order)).rejects.toBeTruthy();
    expect((await db.orders.byId(order.id))!.status).toBe("failed");
    expect(await stockOf("p1", "M")).toBe(5);
  });
});

describe("expiry & recovery", () => {
  async function expireNow(id: string) {
    const o = (await db.orders.byId(id))!;
    await db.orders.save({ ...o, reservedUntil: new Date(Date.now() - 1000).toISOString() });
  }

  it("sweep releases unpaid lapsed holds", async () => {
    const { order } = await placeWithGateway(2);
    await expireNow(order.id);
    expect(await sweepExpired()).toEqual({ released: 1, paid: 0 });
    expect((await db.orders.byId(order.id))!.status).toBe("expired");
    expect(await stockOf("p1", "M")).toBe(5);
  });

  it("sweep SETTLES a lapsed hold when the gateway shows a captured payment (customer paid, tab closed, no webhook)", async () => {
    const { order } = await placeWithGateway(2);
    fake.createPayment(order.razorpayOrderId!);
    await expireNow(order.id);
    expect(await sweepExpired()).toEqual({ released: 0, paid: 1 });
    expect((await db.orders.byId(order.id))!.status).toBe("paid");
    expect(await stockOf("p1", "M")).toBe(3);
  });

  it("a gateway outage during the sweep leaves the order untouched (retried next time)", async () => {
    const { order } = await placeWithGateway(1);
    await expireNow(order.id);
    fake.failNext = "/payments";
    expect(await sweepExpired()).toEqual({ released: 0, paid: 0 });
    expect((await db.orders.byId(order.id))!.status).toBe("pending");
  });

  it("customer retry after expiry re-reserves stock and creates a fresh gateway order", async () => {
    const { order } = await placeWithGateway(2);
    await releaseReservation(order.id, "expired");
    const { order: reopened, needsGatewayOrder } = await reopenForPayment(order.id);
    expect(needsGatewayOrder).toBe(true);
    expect(reopened.status).toBe("pending");
    expect(await stockOf("p1", "M")).toBe(3);
    const ready = await openGatewayOrder(reopened);
    expect(ready.razorpayOrderId).not.toBe(order.razorpayOrderId);
  });

  it("retry fails cleanly when the stock has gone, and never double-reserves", async () => {
    const { order } = await placeWithGateway(5);
    await releaseReservation(order.id, "expired");
    await place(5, key(50));
    await expect(reopenForPayment(order.id)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    expect(await stockOf("p1", "M")).toBe(0);
  });

  it("a paid order can't be re-opened for payment", async () => {
    const { order } = await placeWithGateway(1);
    await markPaid(order.id, capture(order.razorpayOrderId!));
    await expect(reopenForPayment(order.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("admin operations", () => {
  async function paidOrder(qty = 2, k = key(60)) {
    const { order } = await placeWithGateway(qty, k);
    await markPaid(order.id, capture(order.razorpayOrderId!));
    return (await db.orders.byId(order.id))!;
  }

  it("fulfilment moves forward only through paid states", async () => {
    const o = await paidOrder();
    expect((await setFulfilment(o.id, "packed", "admin")).status).toBe("packed");
    expect((await setFulfilment(o.id, "shipped", "admin", "AWB 123")).trackingNote).toBe("AWB 123");
    await expect(setFulfilment(o.id, "cancelled" as never, "admin")).rejects.toBeInstanceOf(OrderError);
  });

  it("an unpaid order cannot be packed/shipped", async () => {
    const { order } = await place(1);
    await expect(setFulfilment(order.id, "packed", "admin")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("cancel only works on unpaid orders and returns stock", async () => {
    const { order } = await place(2, key(61));
    await cancelUnpaid(order.id, "admin");
    expect(await stockOf("p1", "M")).toBe(5);
    const paid = await paidOrder(1, key(62));
    await expect(cancelUnpaid(paid.id, "admin")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("full refund with restock: gateway refunded, ledger written, status refunded, stock returned", async () => {
    const o = await paidOrder(2);
    expect(await stockOf("p1", "M")).toBe(3);
    const r = await refundOrder(o.id, { restock: true, by: "admin" });
    expect(r.status).toBe("refunded");
    expect(r.refundedTotal).toBe(o.total);
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0].amount).toBe(o.total * 100);
    expect(await stockOf("p1", "M")).toBe(5);
  });

  it("partial refund keeps the order live and never restocks", async () => {
    const o = await paidOrder(2);
    const r = await refundOrder(o.id, { amountRupees: 500, restock: true, by: "admin" });
    expect(r.status).toBe("paid");
    expect(r.refundedTotal).toBe(500);
    expect(await stockOf("p1", "M")).toBe(3);
    await expect(refundOrder(o.id, { amountRupees: o.total, restock: false, by: "admin" })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("cannot refund an unpaid order", async () => {
    const { order } = await placeWithGateway(1, key(63));
    await expect(refundOrder(order.id, { restock: false, by: "admin" })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("a gateway refund failure changes nothing locally", async () => {
    const o = await paidOrder(1, key(64));
    fake.failNext = "/refund";
    await expect(refundOrder(o.id, { restock: false, by: "admin" })).rejects.toMatchObject({ code: "GATEWAY" });
    expect((await db.orders.byId(o.id))!.refundedTotal ?? 0).toBe(0);
  });

  it("recordRefund is idempotent per refund id (webhook replays)", async () => {
    const o = await paidOrder(1, key(65));
    await recordRefund(o.id, { id: "rfnd_x", amount: 300, by: "gateway", restock: false });
    await recordRefund(o.id, { id: "rfnd_x", amount: 300, by: "gateway", restock: false });
    expect((await db.orders.byId(o.id))!.refundedTotal).toBe(300);
  });
});

describe("public order view", () => {
  it("exposes only what the customer needs (no token hash, gateway ids, address or phone)", async () => {
    const { order } = await placeWithGateway(1);
    const v = JSON.stringify(publicOrderView(order));
    for (const secret of ["tokenHash", "razorpay", "customer", "address", "phone", "buyer@example.com", "checkoutKey"]) expect(v).not.toContain(secret);
  });
});
