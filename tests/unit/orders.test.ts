import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  OrderError, cancelUnpaid, createPendingOrder, publicOrderView, rejectManualPayment, releaseReservation,
  setFulfilment, submitManualPayment, sweepExpired, tokenMatches, verifyManualPayment,
} from "@/lib/orders";
import { address, customer, freshDb, key, price, seedProduct, stockOf } from "../support/helpers";

beforeEach(async () => {
  freshDb();
  await db.settings.save({ shipping: {}, payment: { reservationMinutes: 20 }, bulk: {} });
  await seedProduct({ id: "p1", price: 1000, stock: { M: 5, L: 1 } });
});

async function place(qty = 2, checkoutKey = key(1), size: "M" | "L" = "M") {
  const priced = await price([{ productId: "p1", size, qty }]);
  return createPendingOrder({ priced, customer, address, checkoutKey });
}

describe("stock reservation", () => {
  it("reserves stock at creation and returns it on cancellation", async () => {
    const { order } = await place(2);
    expect(await stockOf("p1", "M")).toBe(3);
    await cancelUnpaid(order.id, "admin");
    expect(await stockOf("p1", "M")).toBe(5);
  });

  it("maps one checkout key to one reservation", async () => {
    const first = await place(2, key(7));
    const second = await place(2, key(7));
    expect(second.reused).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(tokenMatches(second.order, first.token)).toBe(false);
    expect(tokenMatches(second.order, second.token)).toBe(true);
    expect(await stockOf("p1", "M")).toBe(3);
  });

  it("allows only one buyer to reserve the last unit", async () => {
    const results = await Promise.allSettled([place(1, key(10), "L"), place(1, key(11), "L")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf("p1", "L")).toBe(0);
  });

  it("rejects a price change between pricing and reservation", async () => {
    const priced = await price([{ productId: "p1", size: "M", qty: 1 }]);
    const product = (await db.products.byId("p1"))!;
    await db.products.save({ ...product, price: 1200 });
    await expect(createPendingOrder({ priced, customer, address, checkoutKey: key(20) })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
  });
});

describe("manual verification", () => {
  it("submission never confirms payment", async () => {
    const { order } = await place(1);
    const submitted = await submitManualPayment(order.id, "431209876543");
    expect(submitted.status).toBe("payment_pending");
    expect(submitted.paymentStatus).toBe("verification_pending");
    expect(submitted.paid).toBe(false);
  });

  it("verification confirms an allocated order", async () => {
    const { order } = await place(1);
    await submitManualPayment(order.id, "431209876544");
    const verified = await verifyManualPayment(order.id, "admin");
    expect(verified.status).toBe("confirmed");
    expect(verified.paid).toBe(true);
    expect((await setFulfilment(order.id, "packed", "admin")).status).toBe("packed");
  });

  it("rejection releases stock and records the reason", async () => {
    const { order } = await place(2);
    await submitManualPayment(order.id, "431209876545");
    const rejected = await rejectManualPayment(order.id, "admin", "Not in receiving account");
    expect(rejected.status).toBe("payment_rejected");
    expect(rejected.paymentRejectionReason).toBe("Not in receiving account");
    expect(await stockOf("p1", "M")).toBe(5);
  });

  it("verification after expiry re-reserves available stock", async () => {
    const { order } = await place(2);
    await releaseReservation(order.id, "expired");
    await submitManualPayment(order.id, "431209876546");
    expect((await verifyManualPayment(order.id, "admin")).status).toBe("confirmed");
    expect(await stockOf("p1", "M")).toBe(3);
  });

  it("never confirms after expiry when stock is unavailable", async () => {
    const { order } = await place(2, key(30));
    await releaseReservation(order.id, "expired");
    await place(5, key(31));
    await submitManualPayment(order.id, "431209876547");
    const reviewed = await verifyManualPayment(order.id, "admin");
    expect(reviewed.status).toBe("review");
    expect(reviewed.paid).toBe(true);
    expect(await stockOf("p1", "M")).toBe(0);
  });
});

describe("expiry", () => {
  it("sweep releases a lapsed unpaid hold", async () => {
    const { order } = await place(2);
    await db.orders.save({ ...order, reservedUntil: new Date(Date.now() - 1000).toISOString() });
    expect(await sweepExpired()).toEqual({ released: 1, paid: 0 });
    expect((await db.orders.byId(order.id))?.status).toBe("expired");
    expect(await stockOf("p1", "M")).toBe(5);
  });

  it("a submitted payment remains reviewable after its stock hold expires", async () => {
    const { order } = await place(1);
    const submitted = await submitManualPayment(order.id, "431209876548");
    await db.orders.save({ ...submitted, reservedUntil: new Date(Date.now() - 1000).toISOString() });
    await sweepExpired();
    const reviewed = await db.orders.byId(order.id);
    expect(reviewed?.status).toBe("review");
    expect(reviewed?.paymentStatus).toBe("verification_pending");
  });
});

describe("guardrails", () => {
  it("does not fulfil an unverified order", async () => {
    const { order } = await place(1);
    await expect(setFulfilment(order.id, "packed", "admin")).rejects.toBeInstanceOf(OrderError);
  });

  it("public order data omits secrets and personal details", async () => {
    const { order } = await place(1);
    const view = JSON.stringify(publicOrderView(order));
    for (const secret of ["tokenHash", "customer", "address", "phone", "buyer@example.com", "checkoutKey"]) expect(view).not.toContain(secret);
  });
});
