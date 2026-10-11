import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setDbForTests } from "@/lib/data";
import { createJsonDb } from "@/lib/data/json";
import { db } from "@/lib/db";
import { priceCart, type PriceOk } from "@/lib/pricing";
import type { Product, Size, Variant } from "@/lib/types";
import { SIZES } from "@/lib/types";
import { FakeRazorpay } from "./fake-razorpay";

export function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lk-test-"));
  const store = createJsonDb(dir);
  setDbForTests(store);
  return { store, dir };
}

export async function startFakeGateway() {
  const fake = await new FakeRazorpay(process.env.RAZORPAY_KEY_ID!, process.env.RAZORPAY_KEY_SECRET!, process.env.RAZORPAY_WEBHOOK_SECRET!).start();
  process.env.RAZORPAY_API_BASE = fake.base;
  return fake;
}

export function mkProduct(over: Partial<Product> & { id: string; stock?: Partial<Record<Size, number>>; colors?: string[] }): Product {
  const colors = over.colors ?? ["Ivory"];
  const variants: Variant[] = colors.flatMap((color) => SIZES.map((size) => ({ color, size, stock: over.stock?.[size] ?? 0 })));
  const { stock: _s, colors: _c, ...rest } = over;
  void _s; void _c;
  return {
    slug: over.id,
    name: `Tee ${over.id}`,
    collection: "c",
    price: 1000,
    description: "",
    story: "",
    colors: colors.map((name) => ({ name, hex: "#EADFCB" })),
    variants,
    images: [],
    art: { kind: "sun", seed: 1 },
    tags: [],
    createdAt: new Date().toISOString(),
    published: true,
    ...rest,
  };
}

export const customer = { name: "Test Buyer", phone: "+91 98765 43210", email: "buyer@example.com" };
export const address = { line1: "12 Test Street", city: "Coimbatore", state: "Tamil Nadu", pincode: "641001" };

export async function seedProduct(over: Parameters<typeof mkProduct>[0]) {
  return db.products.save(mkProduct(over));
}

export async function price(lines: { productId: string; color?: string; size: Size; qty: number }[], code?: string): Promise<PriceOk> {
  const r = await priceCart(lines.map((l) => ({ color: "Ivory", ...l })), code);
  if (!r.ok) throw new Error("price failed: " + r.error);
  return r;
}

export async function stockOf(productId: string, size: Size, color = "Ivory") {
  const p = await db.products.byId(productId);
  return p!.variants.find((v) => v.size === size && v.color === color)!.stock;
}

export const key = (n = 0) => `test-checkout-key-${String(n).padStart(4, "0")}-abcdef`;
