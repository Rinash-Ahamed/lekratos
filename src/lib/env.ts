import "server-only";

/**
 * Central, lazily-read environment access. Nothing here is ever logged or sent to the client.
 * Missing optional integrations return undefined so callers can degrade safely.
 */
const get = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

export const isProd = () => process.env.NODE_ENV === "production";
export const isBuildPhase = () => process.env.NEXT_PHASE === "phase-production-build";

export const env = {
  siteUrl: () => (get("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, ""),

  dataBackend: (): "json" | "firestore" => {
    const b = get("DATA_BACKEND");
    if (b === "firestore" || b === "json") return b;
    return get("FIREBASE_SERVICE_ACCOUNT_JSON") || get("FIREBASE_PRIVATE_KEY") ? "firestore" : "json";
  },
  allowJsonInProduction: () => get("ALLOW_JSON_IN_PRODUCTION") === "1",

  firebase: (): { kind: "json"; json: string } | { kind: "keys"; projectId: string; clientEmail: string; privateKey: string } | undefined => {
    const json = get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (json) return { kind: "json", json };
    const projectId = get("FIREBASE_PROJECT_ID");
    const clientEmail = get("FIREBASE_CLIENT_EMAIL");
    const privateKey = get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
    return projectId && clientEmail && privateKey ? { kind: "keys", projectId, clientEmail, privateKey } : undefined;
  },
  storageBucket: () => get("FIREBASE_STORAGE_BUCKET"),

  razorpay: () => {
    const keyId = get("RAZORPAY_KEY_ID");
    const keySecret = get("RAZORPAY_KEY_SECRET");
    return keyId && keySecret ? { keyId, keySecret, webhookSecret: get("RAZORPAY_WEBHOOK_SECRET") } : undefined;
  },
  /** Overridable only to a loopback address (used by the automated tests' fake gateway) – never to a remote host. */
  razorpayBase: () => {
    const base = (get("RAZORPAY_API_BASE") ?? "https://api.razorpay.com").replace(/\/$/, "");
    if (base !== "https://api.razorpay.com") {
      const host = new URL(base).hostname;
      if (host !== "127.0.0.1" && host !== "localhost") throw new Error("RAZORPAY_API_BASE may only point at a loopback address");
    }
    return base;
  },

  admin: () => ({
    passwordHash: get("ADMIN_PASSWORD_HASH"),
    password: get("ADMIN_PASSWORD"),
    sessionSecret: get("ADMIN_SESSION_SECRET"),
  }),
  cronSecret: () => get("CRON_SECRET"),
  reservationMinutes: () => Math.min(120, Math.max(5, Number(get("RESERVATION_MINUTES")) || 20)),
  cspMode: () => (get("CSP_MODE") === "report-only" ? "report-only" : "enforce"),
};
