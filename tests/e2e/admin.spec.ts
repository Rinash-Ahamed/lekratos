import { E2E } from "../../playwright.config";
import { test, expect, fake, stubCheckout, addFirstProduct, fillCheckout } from "./fixtures";
import sharp from "sharp";

test.describe.configure({ mode: "serial" });

test("admin is locked until sign-in; wrong password is rejected", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await request.get("/api/admin/orders")).status()).toBe(401);
  expect((await request.post("/api/admin/products", { data: {} })).status()).toBe(401);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Wrong password" })).toBeVisible();
});

test("sign in, create a product with an uploaded photo and see it in the store", async ({ page, problems }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Launch checklist" })).toBeVisible();

  await page.getByRole("button", { name: "Products" }).click();
  await page.getByRole("button", { name: "+ New product" }).click();
  await page.getByLabel("Name", { exact: true }).fill("E2E Test Tee");
  await page.getByLabel("Price (₹)").fill("1499");
  await page.getByLabel("Fabric (only what you can stand behind)").fill("Test fabric");
  const png = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#aa5533" } }).png().toBuffer();
  await page.locator("input[type=file]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await expect(page.locator("main img[src*='uploads'], main img[src*='products']").first()).toBeVisible();
  await page.getByLabel("Black M stock").fill("20");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByText("Product saved")).toBeVisible();
  await expect(page.getByRole("cell", { name: /E2E Test Tee/ })).toBeVisible();

  const shop = await page.context().newPage();
  await shop.goto("/shop?q=E2E");
  await expect(shop.getByRole("heading", { name: "E2E Test Tee" })).toBeVisible();
  expect(problems.filter((p) => !/favicon/i.test(p))).toEqual([]);
});

test("a non-image upload is rejected", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Products" }).click();
  await page.getByRole("button", { name: "+ New product" }).click();
  await page.locator("input[type=file]").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<?php echo 1; ?>") });
  await expect(page.getByRole("alert").filter({ hasText: /image/i })).toBeVisible();
});

test("settings feed the storefront (contact page) and delete asks for confirmation", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Contact email").fill("hello@example.test");
  await page.getByLabel("Dispatch time").fill("within 3 working days");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  const store = await page.context().newPage();
  await store.goto("/contact");
  await expect(store.getByRole("link", { name: "hello@example.test" })).toBeVisible();

  await page.getByRole("button", { name: "Products" }).click();
  await page.getByRole("row", { name: /E2E Test Tee/ }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("dialog", { name: /Delete/ })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("cell", { name: /E2E Test Tee/ })).toBeVisible();
});

test("order lifecycle: customer pays, admin fulfils, exports CSV and refunds", async ({ page }) => {
  await stubCheckout(page, { mode: "pay" });
  await addFirstProduct(page);
  await fillCheckout(page);
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible();
  const orderId = (await page.locator("strong.select-all").textContent())!;

  const admin = await page.context().newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("Password").fill(E2E.password);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.getByRole("button", { name: "Orders" }).click();
  await admin.getByRole("searchbox", { name: "Search orders" }).fill(orderId);
  await admin.getByRole("row", { name: new RegExp(orderId) }).getByRole("button", { name: "Open" }).click();
  await admin.getByRole("button", { name: "Mark packed" }).click();
  await expect(admin.getByText("Marked packed")).toBeVisible();

  await admin.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  const [dl] = await Promise.all([admin.waitForEvent("download"), admin.getByRole("link", { name: "Export CSV" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/orders.*\.csv$/);
  expect(await (await import("node:fs/promises")).readFile((await dl.path())!, "utf8")).toContain(orderId);

  await admin.getByRole("row", { name: new RegExp(orderId) }).getByRole("button", { name: "Open" }).click();
  const before = fake.refunds.length;
  await admin.getByRole("button", { name: "Refund via Razorpay" }).click();
  await admin.getByRole("dialog", { name: "Issue refund?" }).getByRole("button", { name: "Refund" }).click();
  await expect(admin.getByText("Refund issued")).toBeVisible();
  expect(fake.refunds.length).toBe(before + 1);
});

test("sign out ends the session", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});
