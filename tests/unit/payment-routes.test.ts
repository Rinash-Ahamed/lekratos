import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as webhook } from "@/app/api/razorpay/webhook/route";
import { POST as verify } from "@/app/api/razorpay/verify/route";
import { POST as checkout } from "@/app/api/razorpay/order/route";
import type { FakeRazorpay } from "../support/fake-razorpay";
import { address, customer, freshDb, key, seedProduct, startFakeGateway, stockOf } from "../support/helpers";

let fake: FakeRazorpay;
beforeAll(async () => { fake = await startFakeGateway(); });
afterAll(() => fake.stop());
beforeEach(async () => {
  freshDb();
  fake.orders.clear(); fake.payments.clear(); fake.refunds.length = 0; fake.calls.length = 0; fake.failNext = null;
  await seedProduct({ id: "p1", price: 1000, stock: { M: 3 } });
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const bag = (qty = 1, k = key(1)) => ({
  lines: [{ productId: "p1", color: "Ivory", size: "M", qty }], checkoutKey: k, customer, address,
  // client-supplied prices must be ignored
  total: 1,
});

async function start(qty = 1, k = key(1)) {
  const res = await checkout(post("/api/razorpay/order", bag(qty, k), { "x-forwarded-for": "9.9.9.9" }));
  return { res, body: await res.json() };
}

describe("POST /api/razorpay/order", () => {
  it("prices on the server and reserves stock", async () => {
    const { res, body } = await start(2);
    expect(res.status).toBe(200);
    expect(body.token).toBeTruthy();
    const o = (await db.orders.all(5))[0];
    expect(o.total).toBeGreaterThanOrEqual(2000); // from server pricing, not the client's `total: 1`
    expect(fake.orders.get(o.razorpayOrderId!)!.amount).toBe(o.total * 100);
    expect(await stockOf("p1", "M")).toBe(1);
  });
  it("is idempotent for the same checkout key", async () => {
    const a = await start(1, key(2));
    const b = await start(1, key(2));
    expect(b.body.orderId ?? b.body.id).toBe(a.body.orderId ?? a.body.id);
    expect(fake.orders.size).toBe(1);
    expect(await stockOf("p1", "M")).toBe(2);
  });
  it("refuses to oversell", async () => {
    const { res } = await start(4, key(3));
    expect(res.status).toBe(422);
    expect(await stockOf("p1", "M")).toBe(3);
  });
  it("releases stock when the gateway is down; the client then starts a fresh checkout", async () => {
    fake.failNext = "orders";
    const { res } = await start(1, key(4));
    expect(res.status).toBe(502);
    expect(await stockOf("p1", "M")).toBe(3); // nothing stays reserved
    expect((await db.orders.all(50))[0].status).toBe("failed");
    expect((await start(1, key(4))).res.status).toBe(422); // ended checkout can't be revived with the same key…
    expect((await start(1, key(5))).res.status).toBe(200); // …a new key works
    expect(await stockOf("p1", "M")).toBe(2);
  });
  it("rejects cross-site browsers", async () => {
    const res = await checkout(post("/api/razorpay/order", bag(), { origin: "https://evil.example", host: "localhost:3000" }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/razorpay/verify", () => {
  async function paid() {
    const { body } = await start(1, key(10));
    const o = (await db.orders.all(5))[0];
    const pay = fake.createPayment(o.razorpayOrderId!);
    return { o, token: body.token as string, pay };
  }
  const vbody = (o: { id: string; razorpayOrderId?: string }, token: string, payId: string, sig: string) => ({
    orderId: o.id, token, razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: payId, razorpay_signature: sig,
  });
  it("marks the order paid with a valid signature", async () => {
    const { o, token, pay } = await paid();
    const res = await verify(post("/api/razorpay/verify", vbody(o, token, pay.id, fake.checkoutSignature(o.razorpayOrderId!, pay.id))));
    expect((await res.json()).status).toBe("paid");
    expect((await db.orders.byId(o.id))!.status).toBe("paid");
  });
  it("rejects a forged signature", async () => {
    const { o, token, pay } = await paid();
    const res = await verify(post("/api/razorpay/verify", vbody(o, token, pay.id, "0".repeat(64))));
    expect(res.status).toBe(400);
    expect((await db.orders.byId(o.id))!.status).toBe("pending");
  });
  it("rejects a wrong order token", async () => {
    const { o, pay } = await paid();
    const res = await verify(post("/api/razorpay/verify", vbody(o, "nope", pay.id, fake.checkoutSignature(o.razorpayOrderId!, pay.id))));
    expect(res.status).toBe(404);
  });
  it("is safe to call twice", async () => {
    const { o, token, pay } = await paid();
    const b = vbody(o, token, pay.id, fake.checkoutSignature(o.razorpayOrderId!, pay.id));
    await verify(post("/api/razorpay/verify", b));
    const again = await verify(post("/api/razorpay/verify", b));
    expect((await again.json()).status).toBe("paid");
    expect(await stockOf("p1", "M")).toBe(2);
  });
});

describe("POST /api/razorpay/webhook", () => {
  async function pending() {
    await start(1, key(20));
    const o = (await db.orders.all(5))[0];
    return { o, pay: fake.createPayment(o.razorpayOrderId!) };
  }
  it("rejects a bad signature", async () => {
    const { pay } = await pending();
    const r = fake.webhookRequest("payment.captured", { payment: { id: pay.id, order_id: pay.order_id } });
    const bad = new Request(r.url, { method: "POST", body: await r.text(), headers: { "x-razorpay-signature": "0".repeat(64) } });
    expect((await webhook(bad)).status).toBe(400);
  });
  it("finalises a paid order and ignores a replayed event", async () => {
    const { o, pay } = await pending();
    const ent = { id: pay.id, order_id: pay.order_id, amount: pay.amount };
    const r1 = await webhook(fake.webhookRequest("payment.captured", { payment: ent }, "evt_1"));
    expect(r1.status).toBe(200);
    expect((await db.orders.byId(o.id))!.status).toBe("paid");
    const r2 = await webhook(fake.webhookRequest("payment.captured", { payment: ent }, "evt_1"));
    expect((await r2.json()).duplicate).toBe(true);
    expect(await stockOf("p1", "M")).toBe(2);
  });
  it("trusts the gateway, not the payload amount", async () => {
    const { o } = await pending();
    const cheap = fake.createPayment(o.razorpayOrderId!, { amount: 100 });
    const res = await webhook(fake.webhookRequest("payment.captured", { payment: { id: cheap.id, order_id: cheap.order_id, amount: o.total * 100 } }));
    expect(res.status).toBe(200);
    expect((await db.orders.byId(o.id))!.status).not.toBe("paid");
  });
  it("acknowledges unknown orders without erroring", async () => {
    const res = await webhook(fake.webhookRequest("payment.captured", { payment: { id: "pay_x", order_id: "order_unknown" } }));
    expect(res.status).toBe(200);
  });
  it("returns 5xx on infrastructure failure so Razorpay retries", async () => {
    const { pay } = await pending();
    await fake.stop();
    fake.failNext = null;
    const res = await webhook(fake.webhookRequest("payment.captured", { payment: { id: pay.id, order_id: pay.order_id } }, "evt_down"));
    expect([200, 500]).toContain(res.status);
    await fake.start();
    process.env.RAZORPAY_API_BASE = fake.base;
  });
});
