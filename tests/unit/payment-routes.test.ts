import { beforeEach, describe, expect, it } from "vitest";
import { POST as checkout } from "@/app/api/payment/order/route";
import { POST as submit } from "@/app/api/payment/submit/route";
import { db } from "@/lib/db";
import { rejectManualPayment, verifyManualPayment } from "@/lib/orders";
import { address, customer, freshDb, key, seedProduct, stockOf } from "../support/helpers";

beforeEach(async () => {
  freshDb();
  await seedProduct({ id: "p1", price: 1000, stock: { M: 3 } });
  await db.settings.save({
    shipping: { flatRate: 0 },
    payment: { upiId: "lekratos@upi", payeeName: "LE.KRATOS", qrImage: "/uploads/products/test.webp", reservationMinutes: 20 },
    bulk: {},
  });
});

const jsonPost = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

const bag = (qty = 1, checkoutKey = key(1)) => ({
  lines: [{ productId: "p1", color: "Ivory", size: "M", qty }], checkoutKey, customer, address, total: 1,
});

async function start(qty = 1, checkoutKey = key(1)) {
  const response = await checkout(jsonPost("/api/payment/order", bag(qty, checkoutKey), { "x-forwarded-for": "9.9.9.9" }));
  return { response, body: await response.json() as { orderId: string; token: string; amount: number } };
}

async function submitReference(orderId: string, token: string, reference: string) {
  const form = new FormData();
  form.set("orderId", orderId); form.set("token", token); form.set("reference", reference);
  return submit(new Request("http://localhost:3000/api/payment/submit", { method: "POST", body: form, headers: { "x-forwarded-for": "9.9.9.9" } }));
}

describe("manual UPI checkout", () => {
  it("prices on the server and reserves stock", async () => {
    const { response, body } = await start(2);
    expect(response.status).toBe(200);
    expect(body.amount).toBeGreaterThanOrEqual(2000);
    expect(await stockOf("p1", "M")).toBe(1);
  });

  it("is idempotent for a checkout key", async () => {
    const first = await start(1, key(2));
    const second = await start(1, key(2));
    expect(second.body.orderId).toBe(first.body.orderId);
    expect(await stockOf("p1", "M")).toBe(2);
  });

  it("does not mark an order paid when a reference is submitted", async () => {
    const { body } = await start(1, key(3));
    expect((await submitReference(body.orderId, body.token, "431209876543")).status).toBe(200);
    const order = await db.orders.byId(body.orderId);
    expect(order?.status).toBe("payment_pending");
    expect(order?.paymentStatus).toBe("verification_pending");
    expect(order?.paid).toBe(false);
  });

  it("rejects a duplicate reference on a different order", async () => {
    const a = await start(1, key(4));
    const b = await start(1, key(5));
    await submitReference(a.body.orderId, a.body.token, "431209876544");
    expect((await submitReference(b.body.orderId, b.body.token, "431209876544")).status).toBe(409);
  });

  it("only confirms after an administrator verifies receipt", async () => {
    const { body } = await start(1, key(6));
    await submitReference(body.orderId, body.token, "431209876545");
    const verified = await verifyManualPayment(body.orderId, "admin@example.com");
    expect(verified.status).toBe("confirmed");
    expect(verified.paymentStatus).toBe("verified");
    expect(verified.paid).toBe(true);
  });

  it("releases reserved stock when an administrator rejects payment", async () => {
    const { body } = await start(1, key(7));
    await submitReference(body.orderId, body.token, "431209876546");
    const rejected = await rejectManualPayment(body.orderId, "admin@example.com", "Not found in receiving account");
    expect(rejected.status).toBe("payment_rejected");
    expect(await stockOf("p1", "M")).toBe(3);
  });
});
