import { test, expect, addFirstProduct, fillCheckout } from "./fixtures";

test("home, shop and product pages render with real content and no console errors", async ({ page, problems }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /le\.kratos .* home/ })).toBeVisible();
  await page.goto("/shop");
  expect(await page.locator("article").count()).toBeGreaterThan(0);
  await page.locator("article a[href^='/product/']").first().click();
  await expect(page.getByRole("button", { name: "Size guide" })).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("filters and search narrow the shop", async ({ page }) => {
  await page.goto("/shop");
  const all = await page.locator("article").count();
  await page.getByRole("searchbox", { name: "Search designs" }).fill("zzzz-no-such-design");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nothing matches")).toBeVisible();
  await page.goto("/shop");
  await page.getByLabel("Sort").selectOption("price-asc");
  await expect(page).toHaveURL(/sort=price-asc/);
  expect(await page.locator("article").count()).toBe(all);
});

test("bag totals come from the server and cannot be tampered with", async ({ page, request }) => {
  await addFirstProduct(page);
  await expect(page.getByRole("link", { name: /^Checkout/ })).toBeVisible();
  const response = await request.post("/api/checkout/price", { data: { lines: [{ productId: "x", color: "c", size: "M", qty: 1 }], total: 1 } });
  expect(response.status()).toBe(422);
});

test("manual UPI submission remains pending verification and clears the bag", async ({ page, problems }) => {
  await addFirstProduct(page);
  await fillCheckout(page);
  await page.getByRole("button", { name: /^Continue to UPI/ }).click();
  await expect(page.getByText("Pay exactly")).toBeVisible();
  await page.getByLabel("UPI transaction/reference ID").fill("431209876543");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page).toHaveURL(/\/order\/LK-/);
  await expect(page.getByRole("heading", { name: "We received your payment details." })).toBeVisible();
  await expect(page.getByText("Verification pending")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Open bag, 0 items/ })).toBeVisible();
  expect(problems.filter((problem) => !/favicon/.test(problem))).toEqual([]);
});

test("checkout validates fields before reserving stock", async ({ page }) => {
  await addFirstProduct(page);
  await page.goto("/checkout");
  await page.getByRole("button", { name: /^Continue to UPI/ }).click();
  await expect(page.getByText("Enter your full name")).toBeVisible();
  await expect(page.getByText("Enter a 6-digit pincode")).toBeVisible();
});

test("enquiry form submits and tracking rejects unknown orders", async ({ page }) => {
  await page.goto("/enquiry");
  await page.getByLabel("Name *").fill("Test Team");
  await page.getByLabel("Contact number *").fill("9876543210");
  await page.getByLabel("Total quantity *").fill("25");
  await page.getByLabel("Delivery location *").fill("Chennai, Tamil Nadu");
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByText("Received.")).toBeVisible();
  await page.goto("/track");
  await page.getByLabel("Order ID").fill("LK-NOPE");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn't match" })).toBeVisible();
});

test("policy pages, 404, sitemap, robots and JSON-LD exist", async ({ page, request }) => {
  for (const path of ["/privacy", "/terms", "/shipping", "/returns", "/contact"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  expect((await page.goto("/definitely-missing"))?.status()).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/shop");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");
  await page.goto("/shop");
  await page.locator("article a[href^='/product/']").first().click();
  await page.waitForURL(/\/product\//);
  await expect(page.locator("script[type='application/ld+json']").nth(1)).toBeAttached();
});
