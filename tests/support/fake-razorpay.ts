import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A tiny local stand-in for Razorpay's REST API (orders, payments, refunds) so the payment code can be
 * exercised end-to-end without real credentials. It is NOT Razorpay: it only implements the calls this
 * project makes, with the response fields this project reads.
 */
export interface FakePayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
  amount_refunded: number;
  error_description?: string | null;
}
interface FakeOrder { id: string; amount: number; currency: string; receipt?: string; status: string }

export class FakeRazorpay {
  orders = new Map<string, FakeOrder>();
  payments = new Map<string, FakePayment>();
  refunds: { id: string; payment_id: string; amount: number }[] = [];
  calls: string[] = [];
  failNext: string | null = null;
  private server!: http.Server;
  base = "";

  constructor(public keyId: string, public keySecret: string, public webhookSecret: string) {}

  async start(port = 0) {
    this.server = http.createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((r) => this.server.listen(port, "127.0.0.1", r));
    this.base = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }
  async stop() {
    await new Promise<void>((r) => this.server.close(() => r()));
  }

  /* ---- test hooks ---- */
  createPayment(orderId: string, p: Partial<FakePayment> = {}): FakePayment {
    const o = this.orders.get(orderId);
    if (!o) throw new Error("unknown fake order " + orderId);
    const pay: FakePayment = {
      id: "pay_" + crypto.randomBytes(7).toString("hex"),
      order_id: orderId,
      amount: o.amount,
      currency: o.currency,
      status: "captured",
      method: "upi",
      amount_refunded: 0,
      ...p,
    };
    this.payments.set(pay.id, pay);
    if (pay.status === "captured") o.status = "paid";
    return pay;
  }
  checkoutSignature(orderId: string, paymentId: string) {
    return crypto.createHmac("sha256", this.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  }
  /** Builds a signed webhook Request exactly like Razorpay would send it. */
  webhookRequest(event: string, entities: { payment?: object; refund?: object; order?: object }, eventId = "evt_" + crypto.randomBytes(6).toString("hex")) {
    const body = JSON.stringify({ event, payload: Object.fromEntries(Object.entries(entities).map(([k, v]) => [k, { entity: v }])) });
    const sig = crypto.createHmac("sha256", this.webhookSecret).update(body).digest("hex");
    return new Request("http://localhost:3000/api/razorpay/webhook", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-razorpay-signature": sig, "x-razorpay-event-id": eventId },
    });
  }

  /* ---- http ---- */
  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? "/", this.base);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const auth = req.headers.authorization ?? "";
    if (auth !== `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`)
      return send(401, { error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } });

    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    this.calls.push(`${req.method} ${url.pathname}`);

    if (this.failNext && url.pathname.includes(this.failNext)) {
      this.failNext = null;
      return send(500, { error: { code: "SERVER_ERROR", description: "boom" } });
    }

    if (req.method === "POST" && url.pathname === "/v1/orders") {
      const o: FakeOrder = { id: "order_" + crypto.randomBytes(7).toString("hex"), amount: body.amount, currency: body.currency, receipt: body.receipt, status: "created" };
      this.orders.set(o.id, o);
      return send(200, o);
    }
    let m = url.pathname.match(/^\/v1\/orders\/([^/]+)\/payments$/);
    if (req.method === "GET" && m) return send(200, { items: [...this.payments.values()].filter((p) => p.order_id === m![1]) });
    m = url.pathname.match(/^\/v1\/payments\/([^/]+)$/);
    if (req.method === "GET" && m) {
      const p = this.payments.get(m[1]);
      return p ? send(200, p) : send(400, { error: { code: "BAD_REQUEST_ERROR", description: "The id provided does not exist" } });
    }
    m = url.pathname.match(/^\/v1\/payments\/([^/]+)\/refund$/);
    if (req.method === "POST" && m) {
      const p = this.payments.get(m[1]);
      if (!p || p.status === "failed") return send(400, { error: { code: "BAD_REQUEST_ERROR", description: "Payment cannot be refunded" } });
      if (body.amount > p.amount - p.amount_refunded) return send(400, { error: { code: "BAD_REQUEST_ERROR", description: "Refund amount exceeds the captured amount" } });
      p.amount_refunded += body.amount;
      if (p.amount_refunded === p.amount) p.status = "refunded";
      const r = { id: "rfnd_" + crypto.randomBytes(6).toString("hex"), payment_id: p.id, amount: body.amount };
      this.refunds.push(r);
      return send(200, r);
    }
    send(404, { error: { code: "NOT_FOUND", description: "unknown route" } });
  }
}
