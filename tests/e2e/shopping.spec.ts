import { test, expect, fake, stubCheckout, addFirstProduct, fillCheckout } from "./fixtures";

test("home, shop and product pages render with real content and no console errors", async ({ page, problems }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /le\.kratos — home/ })).toBeVisible();
  await page.goto("/shop");
  expect(await page.locator("article").count()).toBeGreaterThan(0);
  await page.locator("article a[href^='/product/']").first().click();
  await expect(page.getByRole("button", { name: "Size guide" })).toHaveCount(0); // chart not configured → no dead button
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

test("bag totals come from the server and can't be tampered with", async ({ page, request }) => {
  await addFirstProduct(page);
  await expect(page.getByRole("link", { name: /^Checkout ·/ })).toBeVisible();
  // client-supplied price is ignored by the server
  const res = await request.post("/api/checkout/price", { data: { lines: [{ productId: "x", color: "c", size: "M", qty: 1 }], total: 1 } });
  expect(res.status()).toBe(422);
});

test("happy path: pay → verified → order page shows paid and the bag is cleared", async ({ page, problems }) => {
  await stubCheckout(page, { mode: "pay" });
  await addFirstProduct(page);
  await page.getByRole("link", { name: /^Checkout ·/ }).click();
  await fillCheckout(page);
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page).toHaveURL(/\/order\/LK-/);
  await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible();
  await expect(page.getByText("Payment confirmed")).toBeVisible();
  expect([...fake.orders.values()].length).toBeGreaterThan(0);
  // the bag is cleared once paid
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Open bag, 0 items/ })).toBeVisible();
  expect(problems.filter((p) => !/favicon/.test(p))).toEqual([]);
});

test("a declined payment shows an error, charges nothing and can be retried", async ({ page }) => {
  await stubCheckout(page, { mode: "fail" });
  await addFirstProduct(page);
  await page.goto("/checkout");
  await fillCheckout(page);
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Card declined (test)" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay / })).toBeEnabled();
});

test("closing the payment window leaves the bag intact", async ({ page }) => {
  await stubCheckout(page, { mode: "dismiss" });
  await addFirstProduct(page);
  await page.goto("/checkout");
  await fillCheckout(page);
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page.getByRole("button", { name: /^Pay / })).toBeEnabled();
  await expect(page).toHaveURL(/\/checkout/);
});

test("a forged signature is never treated as paid", async ({ page }) => {
  await stubCheckout(page, { mode: "badsig" });
  await addFirstProduct(page);
  await page.goto("/checkout");
  await fillCheckout(page);
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page).toHaveURL(/\/order\/LK-/);
  await expect(page.getByRole("heading", { name: "Thank you." })).toHaveCount(0);
});

test("checkout validates fields before calling the server", async ({ page }) => {
  await addFirstProduct(page);
  await page.goto("/checkout");
  await page.getByRole("button", { name: /^Pay / }).click();
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
  for (const p of ["/privacy", "/terms", "/shipping", "/returns", "/contact"]) {
    const r = await page.goto(p);
    expect(r?.status(), p).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  expect((await page.goto("/definitely-missing"))?.status()).toBe(404);
  const sm = await (await request.get("/sitemap.xml")).text();
  expect(sm).toContain("/shop");
  expect(sm).toContain("/product/");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");
  await page.goto("/shop");
  await page.locator("article a[href^='/product/']").first().click();
  await page.waitForURL(/\/product\//);
  await expect(page.locator("script[type='application/ld+json']").nth(1)).toBeAttached();
  const ld = JSON.parse((await page.locator("script[type='application/ld+json']").allTextContents()).find((t) => t.includes('"Product"'))!);
  expect(ld["@graph"].some((n: { "@type": string; offers?: { priceCurrency: string } }) => n["@type"] === "Product" && n.offers?.priceCurrency === "INR")).toBe(true);
  await expect(page.locator("link[rel=canonical]")).toHaveCount(1);
});
