import { vi } from "vitest";

// Server code reads these lazily; tests never touch real credentials.
process.env.DATA_BACKEND = "json";
process.env.ADMIN_SESSION_SECRET = "test-session-secret-0123456789abcdef0123456789";
process.env.ADMIN_PASSWORD = "correct horse battery staple"; // plaintext is only honoured outside production
process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
process.env.RAZORPAY_KEY_SECRET = "unit_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "unit_webhook_secret";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

// Next runtime APIs that only exist inside a request.
vi.mock("next/headers", async () => {
  const { jar } = await import("./cookie-jar");
  return {
    cookies: async () => ({ get: (n: string) => (n in jar ? { name: n, value: jar[n] } : undefined) }),
    headers: async () => new Headers(),
  };
});
vi.mock("next/cache", () => ({
  revalidateTag: () => undefined,
  unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn,
}));
