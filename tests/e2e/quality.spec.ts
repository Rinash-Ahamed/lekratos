import AxeBuilder from "@axe-core/playwright";
import { test, expect, addFirstProduct } from "./fixtures";

const PAGES = ["/", "/shop", "/enquiry", "/track", "/privacy", "/terms", "/shipping", "/returns", "/contact", "/wishlist"];

test.describe("accessibility (axe, WCAG 2 A/AA)", () => {
  for (const url of PAGES)
    test(`no serious violations on ${url}`, async ({ page }) => {
      await page.goto(url);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });

  test("product page, bag drawer and checkout", async ({ page }) => {
    await addFirstProduct(page);
    await expect(page.getByRole("link", { name: /^Checkout ·/ })).toHaveAttribute("aria-disabled", "false");
    await page.waitForTimeout(400); // let the opacity transition settle
    for (const label of ["product+drawer", "checkout"]) {
      if (label === "checkout") {
        await page.goto("/checkout");
        await expect(page.getByRole("button", { name: /^Pay ₹/ })).toBeEnabled();
        await page.waitForTimeout(400); // let the opacity transition settle
      }
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${label} ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
  });
});

const WIDTHS = [375, 768, 1280];
test.describe("responsive layout", () => {
  for (const w of WIDTHS)
    test(`no horizontal overflow at ${w}px; screenshots saved`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      for (const url of ["/", "/shop", "/enquiry", "/privacy"]) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${url} @${w}`).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `test-results/screens/${w}${url === "/" ? "-home" : url.replace("/", "-")}.png`, fullPage: true });
      }
      await page.goto("/shop");
      await page.locator("article a[href^='/product/']").first().click();
      await page.waitForURL(/\/product\//);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `product @${w}`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screens/${w}-product.png` });
    });

  test("mobile: menu is a proper dialog (Esc closes, focus returns) and the sticky buy bar shows", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
    await page.goto("/shop");
    await page.locator("article a[href^='/product/']").first().click();
    await page.waitForURL(/\/product\//);
    await expect(page.getByRole("button", { name: /Select size|Add ·/ })).toBeVisible();
  });
});

test("reduced motion: reveal content is visible immediately", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  const hidden = await page.evaluate(() => [...document.querySelectorAll(".reveal")].filter((e) => getComputedStyle(e).opacity === "0").length);
  expect(hidden).toBe(0);
  await ctx.close();
});

test("performance budget on the home page (production build, local)", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __m: { cls: number; lcp: number } }).__m = { cls: 0, lcp: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __m: { cls: number } }).__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { const es = l.getEntries(); (window as unknown as { __m: { lcp: number } }).__m.lcp = es[es.length - 1].startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  let js = 0;
  page.on("response", async (r) => { if (r.url().includes("/_next/static/") && r.url().endsWith(".js")) js += Number(r.headers()["content-length"] ?? 0) || (await r.body().catch(() => Buffer.alloc(0))).length; });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => (window as unknown as { __m: { cls: number; lcp: number } }).__m);
  console.log(`PERF cls=${m.cls.toFixed(4)} lcp=${Math.round(m.lcp)}ms js=${Math.round(js / 1024)}kB (compressed transfer may differ)`);
  expect(m.cls).toBeLessThan(0.1);
  expect(m.lcp).toBeLessThan(2500);
});
