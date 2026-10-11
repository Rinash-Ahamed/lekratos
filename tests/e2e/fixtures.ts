import { test as base, expect, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { FakeRazorpay } from "../support/fake-razorpay";

export const fake = new FakeRazorpay(E2E.keyId, E2E.keySecret, E2E.webhookSecret);
let started = false;

/** Collects console errors / failed requests so tests can assert the page is clean. */
export const test = base.extend<{ problems: string[] }>({
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    await use(problems);
  },
});
test.beforeAll(async () => { if (!started) { started = true; await fake.start(E2E.gateway); } });
test.afterAll(async () => { /* the worker exits; the fake dies with it */ });
export { expect };

/** Installs a stand-in for Razorpay's checkout.js. `outcome` decides what the "customer" does in the modal. */
export async function stubCheckout(page: Page, outcome: { mode: "pay" | "fail" | "dismiss" | "badsig" }) {
  await page.exposeFunction("__lkPay", async (razorpayOrderId: string) => {
    if (outcome.mode === "pay" || outcome.mode === "badsig") {
      const p = fake.createPayment(razorpayOrderId);
      return { id: p.id, sig: outcome.mode === "badsig" ? "0".repeat(64) : fake.checkoutSignature(razorpayOrderId, p.id) };
    }
    return null;
  });
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.Razorpay = function (o) {
        this.on = function (e, cb) { if (e === "payment.failed") this._failed = cb; };
        this.open = async function () {
          const r = await window.__lkPay(o.order_id);
          if (r) return o.handler({ razorpay_order_id: o.order_id, razorpay_payment_id: r.id, razorpay_signature: r.sig });
          if (${JSON.stringify(outcome.mode)} === "fail" && this._failed) return this._failed({ error: { description: "Card declined (test)" } });
          o.modal && o.modal.ondismiss && o.modal.ondismiss();
        };
      };`,
    }),
  );
}

export async function addFirstProduct(page: Page) {
  await page.goto("/shop");
  await page.locator("article a[href^='/product/']").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // stock is reserved by every started checkout, so pick whichever size is still available
  await page.getByRole("button", { name: /^(XS|S|M|L|XL|XXL)$/ }).and(page.locator(":enabled")).first().click();
  await page.getByRole("button", { name: /^Add to bag/ }).click();
  await expect(page.getByRole("dialog", { name: "Shopping bag" })).toBeVisible();
}
export async function fillCheckout(page: Page) {
  await page.goto("/checkout");
  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Phone").fill("+91 98765 43210");
  await page.getByLabel("Email").fill("buyer@example.com");
  await page.getByLabel("Address", { exact: true }).fill("12 Test Street");
  await page.getByLabel("City").fill("Coimbatore");
  await page.getByLabel("State").fill("Tamil Nadu");
  await page.getByLabel("Pincode").fill("641001");
}

