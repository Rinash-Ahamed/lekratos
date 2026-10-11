import "server-only";
import { db } from "./db";
import { adminConfigured } from "./admin-auth";
import { env, isProd } from "./env";

export interface Check {
  key: string;
  label: string;
  ok: boolean;
  level: "required" | "recommended";
  hint: string;
}

/** Launch checklist shown in Admin → Overview. Booleans only – never secret values. */
export async function readiness(): Promise<Check[]> {
  const s = await db.settings.get();
  const products = await db.products.all();
  const real = products.filter((p) => !p.sample);
  const a = env.admin();
  const rz = env.razorpay();
  return [
    { key: "backend", label: "Production database (Firestore)", ok: env.dataBackend() === "firestore", level: "required", hint: "Set DATA_BACKEND=firestore and the FIREBASE_* credentials." },
    { key: "storage", label: "Cloud image storage", ok: !!env.storageBucket() && env.dataBackend() === "firestore", level: "required", hint: "Set FIREBASE_STORAGE_BUCKET." },
    { key: "razorpay", label: "Razorpay API keys", ok: !!rz, level: "required", hint: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
    { key: "webhook", label: "Razorpay webhook secret", ok: !!rz?.webhookSecret, level: "required", hint: "Create a webhook → /api/razorpay/webhook, set RAZORPAY_WEBHOOK_SECRET." },
    { key: "adminhash", label: "Hashed admin password", ok: !!a.passwordHash && adminConfigured(), level: "required", hint: "Run `npm run admin:hash` and set ADMIN_PASSWORD_HASH + a 32+ char ADMIN_SESSION_SECRET." },
    { key: "cron", label: "Scheduled stock-hold sweep", ok: !!env.cronSecret(), level: "recommended", hint: "Set CRON_SECRET and call /api/cron/sweep every ~5 minutes." },
    { key: "siteurl", label: "Public site URL", ok: !!process.env.NEXT_PUBLIC_SITE_URL, level: "required", hint: "Set NEXT_PUBLIC_SITE_URL (used for canonical URLs, sitemap, Open Graph)." },
    { key: "legal", label: "Legal business name", ok: !!s.legalName, level: "required", hint: "Store settings → Business." },
    { key: "contact", label: "Contact email and phone", ok: !!s.email && !!s.phone, level: "required", hint: "Store settings → Business." },
    { key: "address", label: "Business address", ok: !!s.address, level: "required", hint: "Store settings → Business." },
    { key: "shipping", label: "Shipping rate configured", ok: s.shipping.flatRate !== undefined && s.shipping.flatRate !== null, level: "required", hint: "Store settings → Shipping (0 is a valid rate)." },
    { key: "delivery", label: "Dispatch & delivery times", ok: !!s.shipping.dispatchTime && !!s.shipping.deliveryTime, level: "required", hint: "Store settings → Shipping." },
    { key: "returns", label: "Returns & refund policy", ok: !!s.returnsPolicy, level: "required", hint: "Store settings → Policies." },
    { key: "sizechart", label: "Size chart", ok: !!s.sizeChart?.rows?.length, level: "recommended", hint: "Store settings → Size chart." },
    { key: "products", label: "Real products published", ok: real.some((p) => p.published), level: "required", hint: "Add your designs in Products." },
    { key: "samples", label: "Sample products removed", ok: !products.some((p) => p.sample), level: isProd() ? "required" : "recommended", hint: "Delete the products labelled “Sample”." },
  ];
}
