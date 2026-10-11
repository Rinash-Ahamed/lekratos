/**
 * Non-destructive migration: legacy JSON files  →  Firestore (or the v2 JSON store with --target=json).
 *
 *   npm run migrate                 # DRY RUN – prints what would happen, writes nothing
 *   npm run migrate -- --apply      # performs the copy
 *
 * Safety properties
 *  - never deletes or edits the source files (.data/*.json, public/uploads/*)
 *  - uses create-if-absent, so re-running is safe and never overwrites newer data in the target
 *  - v1 "placed" (unpaid) orders become "expired" (they never reserved stock)
 *  - v1 demo products (ids p1–p8) are only FLAGGED `sample: true` so you can remove them in the admin
 *  - local product images are copied to Firebase Storage and the URLs rewritten in the NEW documents only
 *  - enquiry reference images are copied to PRIVATE storage (they were publicly reachable in v1)
 */
import { promises as fs } from "fs";
import path from "path";
import { getDb, setDbForTests } from "../src/lib/data";
import { createJsonDb } from "../src/lib/data/json";
import { saveProductImageBuffer, savePrivateAttachmentBuffer } from "../src/lib/storage";
import type { Col } from "../src/lib/data/db";
import type { Enquiry, Order, Product } from "../src/lib/types";
import { sha256 } from "../src/lib/ids";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const target = process.argv.find((a) => a.startsWith("--target="))?.split("=")[1] ?? "firestore";
const srcDir = process.argv.find((a) => a.startsWith("--from="))?.split("=")[1] ?? path.join(process.cwd(), ".data");
const uploadsDir = path.join(process.cwd(), "public", "uploads");

async function loadEnv() {
  try {
    for (const line of (await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8")).split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local */
  }
}

/** v1 files were arrays; v2 JSON files are { id: doc } maps. Accept both. */
async function readRows<T>(name: string): Promise<T[]> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(srcDir, `${name}.json`), "utf8"));
    return Array.isArray(raw) ? raw : Object.values(raw);
  } catch {
    return [];
  }
}

export const mapOrder = (o: Order): Order => ((o.status as string) === "placed" ? { ...o, status: o.paid ? "paid" : "expired" } : o);
export const isV1Demo = (p: Product) => /^p[1-8]$/.test(p.id);

async function localFile(url: string): Promise<Buffer | null> {
  if (!url.startsWith("/uploads/")) return null;
  const name = path.basename(url);
  return (await fs.readFile(path.join(uploadsDir, name)).catch(() => null)) ?? (await fs.readFile(path.join(process.cwd(), ".data", "uploads", "products", name)).catch(() => null));
}

async function main() {
  await loadEnv();
  if (target === "json") setDbForTests(createJsonDb(path.join(process.cwd(), ".data-v2")));
  else process.env.DATA_BACKEND = "firestore";
  const db = getDb();
  const report: Record<string, { found: number; created: number; skipped: number }> = {};
  const bump = (k: string, f: keyof (typeof report)[string]) => ((report[k] ??= { found: 0, created: 0, skipped: 0 })[f]++);

  async function put(col: Col, id: string, doc: object, label: string) {
    bump(label, "found");
    if (!apply) return;
    bump(label, (await db.create(col, id, doc)) ? "created" : "skipped");
  }

  for (const p of await readRows<Product>("products")) {
    const images: string[] = [];
    for (const url of p.images ?? []) {
      const buf = apply && target === "firestore" ? await localFile(url) : null;
      images.push(buf ? await saveProductImageBuffer(buf) : url);
    }
    await put("products", p.id, { ...p, images, sample: p.sample ?? (isV1Demo(p) || undefined) }, "products");
  }
  for (const c of await readRows<{ slug: string }>("collections")) await put("collections", c.slug, c, "collections");
  for (const o of await readRows<Order>("orders")) await put("orders", o.id, mapOrder(o), "orders");
  for (const e of await readRows<Enquiry>("enquiries")) {
    let next: Enquiry = e;
    if (e.referenceImage) {
      const buf = apply && target === "firestore" ? await localFile(e.referenceImage) : null;
      if (buf) next = { ...e, attachmentKey: await savePrivateAttachmentBuffer(buf), referenceImage: undefined };
    }
    await put("enquiries", e.id, next, "enquiries");
  }
  for (const o of await readRows<{ id: string }>("offers")) await put("offers", o.id, o, "offers");
  for (const b of await readRows<{ id: string }>("banners")) await put("banners", b.id, b, "banners");
  for (const s of await readRows<{ email: string }>("subscribers")) await put("subscribers", sha256(s.email), s, "subscribers");

  console.log(apply ? "APPLIED" : "DRY RUN (no writes) — re-run with --apply", `· target=${target} · source=${srcDir}`);
  console.table(report);
  if (apply && target === "firestore") console.log("Source files were left untouched. Verify in the Firebase console, then switch DATA_BACKEND=firestore.");
}

main().catch((e) => {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
