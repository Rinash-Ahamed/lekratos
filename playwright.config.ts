import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs the PRODUCTION build (`next start`) against a throw-away JSON data dir and a LOCAL fake of Razorpay's
 * REST API (tests/support/fake-razorpay.ts, port 4010). It is not Razorpay's sandbox.
 */
export const E2E = {
  port: 3100,
  gateway: 4010,
  password: "e2e-admin-password-123",
  keyId: "rzp_test_e2e",
  keySecret: "e2e_key_secret",
  webhookSecret: "e2e_webhook_secret",
};

const N = 16384;
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(E2E.password, salt, 32, { N, r: 8, p: 1, maxmem: 128 * N * 8 * 2 });
// next start persists unstable_cache entries in .next/cache; clear them so a run never sees another run's catalog
if (!process.env.TEST_WORKER_INDEX) fs.rmSync(path.join(process.cwd(), ".next", "cache"), { recursive: true, force: true });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lk-e2e-"));
const chromium = process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL: `http://localhost:${E2E.port}`,
    trace: "retain-on-failure",
    launchOptions: chromium ? { executablePath: chromium, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${E2E.port}`,
    url: `http://localhost:${E2E.port}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: "production",
      DATA_BACKEND: "json",
      ALLOW_JSON_IN_PRODUCTION: "1",
      JSON_DATA_DIR: dataDir,
      ADMIN_SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
      ADMIN_PASSWORD_HASH: `scrypt:${N}:8:1:${salt.toString("base64")}:${hash.toString("base64")}`,
      RAZORPAY_KEY_ID: E2E.keyId,
      RAZORPAY_KEY_SECRET: E2E.keySecret,
      RAZORPAY_WEBHOOK_SECRET: E2E.webhookSecret,
      RAZORPAY_API_BASE: `http://127.0.0.1:${E2E.gateway}`,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${E2E.port}`,
    },
  },
});
