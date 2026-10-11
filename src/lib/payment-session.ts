import "server-only";
import { env } from "./env";
import type { Order } from "./types";

/** What the browser needs to open the Razorpay modal. keyId is the PUBLISHABLE key. */
export function paymentSession(order: Order) {
  return {
    orderId: order.id,
    razorpayOrderId: order.razorpayOrderId!,
    amount: order.total * 100,
    currency: "INR" as const,
    keyId: env.razorpay()!.keyId,
    reservedUntil: order.reservedUntil,
  };
}
