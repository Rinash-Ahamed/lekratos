import "server-only";
import crypto from "crypto";
import { env } from "./env";
import { safeEqual } from "./ids";

/**
 * Minimal Razorpay REST client (no SDK). Endpoints used:
 *   POST /v1/orders · GET /v1/payments/:id · GET /v1/orders/:id/payments · POST /v1/payments/:id/refund
 * Credentials never leave this module; errors carry only Razorpay's public error code/description.
 */
export class RazorpayError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "RazorpayError";
  }
}

export interface RzOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: "created" | "attempted" | "paid";
}
export interface RzPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  captured?: boolean;
  amount_refunded?: number;
  created_at?: number;
  error_description?: string | null;
}
export interface RzRefund {
  id: string;
  payment_id: string;
  amount: number;
  status?: string;
}

function creds() {
  const c = env.razorpay();
  if (!c) throw new RazorpayError(503, "NOT_CONFIGURED", "Payments are not configured");
  return c;
}

export const razorpayConfigured = () => !!env.razorpay();

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { keyId, keySecret } = creds();
  let res: Response;
  try {
    res = await fetch(`${env.razorpayBase()}/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    throw new RazorpayError(504, "NETWORK", "Could not reach the payment gateway");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; description?: string } };
  if (!res.ok) throw new RazorpayError(res.status, json.error?.code ?? "GATEWAY_ERROR", json.error?.description ?? "Gateway error");
  return json as T;
}

export const gateway = {
  createOrder: (p: { amountPaise: number; receipt: string; notes?: Record<string, string> }) =>
    call<RzOrder>("POST", "/orders", { amount: p.amountPaise, currency: "INR", receipt: p.receipt, notes: p.notes }),
  fetchPayment: (id: string) => call<RzPayment>("GET", `/payments/${encodeURIComponent(id)}`),
  fetchOrderPayments: async (orderId: string) =>
    (await call<{ items: RzPayment[] }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`)).items ?? [],
  refund: (paymentId: string, p: { amountPaise: number; note?: string }) =>
    call<RzRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
      amount: p.amountPaise,
      notes: p.note ? { note: p.note.slice(0, 200) } : undefined,
    }),
};

const hmacHex = (secret: string, data: string | Buffer) => crypto.createHmac("sha256", secret).update(data).digest("hex");

/** Checkout-handler signature: HMAC_SHA256(order_id|payment_id, key_secret) */
export function verifyCheckoutSignature(rzOrderId: string, paymentId: string, signature: string): boolean {
  const c = env.razorpay();
  if (!c || !signature) return false;
  return safeEqual(hmacHex(c.keySecret, `${rzOrderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret) */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = env.razorpay()?.webhookSecret;
  if (!secret || !signature) return false;
  return safeEqual(hmacHex(secret, rawBody), signature);
}
