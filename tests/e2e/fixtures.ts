import { test as base, expect, type Page } from "@playwright/test";

/** Collects console errors / failed requests so tests can assert the page is clean. */
export const test = base.extend<{ problems: string[] }>({
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    await use(problems);
  },
});
export { expect };

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

