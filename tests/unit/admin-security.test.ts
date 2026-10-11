import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/admin/login/route";
import { GET as session } from "@/app/api/admin/session/route";
import { POST as upload } from "@/app/api/admin/upload/route";
import { GET as exportCsv } from "@/app/api/admin/orders/export/route";
import { createSession, destroySession, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_COOKIE, parseSessionToken, signSessionToken } from "@/lib/admin-session";
import { getDb } from "@/lib/data";
import { db } from "@/lib/db";
import { sanitizeBuffer, UploadError } from "@/lib/storage";
import { rateLimit } from "@/lib/security";
import { setCookies } from "../support/cookie-jar";
import { address, customer, freshDb, seedProduct } from "../support/helpers";
import sharp from "sharp";

const SECRET = process.env.ADMIN_SESSION_SECRET!;
beforeEach(() => { freshDb(); setCookies({}); });

const req = (method: string, headers: Record<string, string> = {}, body?: BodyInit) =>
  new Request("http://localhost:3000/api/admin/x", { method, headers, body });

async function signedIn() {
  const s = await createSession(req("POST"));
  setCookies({ [ADMIN_COOKIE]: s.token });
  return s;
}

describe("admin session", () => {
  it("rejects requests with no cookie", async () => {
    expect((await session(req("GET"))).status).toBe(401);
  });
  it("accepts a valid session and exposes the csrf token", async () => {
    const s = await signedIn();
    const r = await session(req("GET"));
    expect(r.status).toBe(200);
    expect((await r.json()).csrf).toBe(s.csrf);
  });
  it("rejects a tampered or expired token", async () => {
    const s = await signedIn();
    const [sid, exp, sig] = s.token.split(".");
    expect(await parseSessionToken(`${sid}.${Number(exp) + 1}.${sig}`, SECRET)).toBeNull();
    expect(await parseSessionToken(await signSessionToken(sid, Date.now() - 1, SECRET), SECRET)).toBeNull();
    expect(await parseSessionToken(s.token, "another-secret-another-secret-another!!")).toBeNull();
  });
  it("a revoked (logged-out) session stops working even with a valid signature", async () => {
    const s = await signedIn();
    await destroySession(s.token.split(".")[0]);
    expect((await session(req("GET"))).status).toBe(401);
  });
});

describe("CSRF and origin checks on unsafe methods", () => {
  it("blocks POST without the csrf header", async () => {
    await signedIn();
    const r = await requireAdmin(req("POST"));
    expect(r instanceof Response && r.status).toBe(403);
  });
  it("blocks a wrong csrf header", async () => {
    await signedIn();
    const r = await requireAdmin(req("POST", { "x-csrf-token": "wrong" }));
    expect(r instanceof Response && r.status).toBe(403);
  });
  it("blocks a cross-origin request even with a valid token", async () => {
    const s = await signedIn();
    const r = await requireAdmin(req("POST", { "x-csrf-token": s.csrf, origin: "https://evil.example", host: "localhost:3000" }));
    expect(r instanceof Response && r.status).toBe(403);
  });
  it("allows a same-origin request with the token", async () => {
    const s = await signedIn();
    const r = await requireAdmin(req("POST", { "x-csrf-token": s.csrf, origin: "http://localhost:3000", host: "localhost:3000" }));
    expect(r instanceof Response).toBe(false);
  });
});

describe("login", () => {
  const attempt = (password: string, ip = "1.1.1.1") =>
    login(new Request("http://localhost:3000/api/admin/login", { method: "POST", body: JSON.stringify({ password }), headers: { "content-type": "application/json", "x-forwarded-for": ip } }));
  it("accepts the right password and sets an httpOnly strict cookie", async () => {
    const r = await attempt(process.env.ADMIN_PASSWORD!);
    expect(r.status).toBe(200);
    const c = r.headers.get("set-cookie")!;
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=strict/i);
  });
  it("rate-limits repeated failures per IP", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await attempt("nope", "2.2.2.2")).status);
    expect(codes.slice(0, 6).every((c) => c === 401)).toBe(true);
    expect(codes.slice(6)).toEqual([429, 429]);
    expect((await attempt("nope", "3.3.3.3")).status).toBe(401); // other IPs unaffected
  }, 20000);
  it("never logs the attempted password to the audit log", async () => {
    await attempt("super-secret-guess", "4.4.4.4");
    expect(JSON.stringify(await getDb().list("auditLogs", { limit: 50 }))).not.toContain("super-secret-guess");
  });
});

describe("every admin route is gated", () => {
  const root = path.resolve(__dirname, "../../src/app/api/admin");
  const files: string[] = [];
  (function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") files.push(p);
    }
  })(root);
  const PUBLIC = new Set(["login", "logout"]); // login establishes the session; logout only deletes one
  it("covers all handlers", () => expect(files.length).toBeGreaterThanOrEqual(7));
  for (const f of files) {
    const name = path.relative(root, f);
    it(`${name} calls requireAdmin`, () => {
      const src = fs.readFileSync(f, "utf8");
      if ([...PUBLIC].some((p) => name.startsWith(p))) return;
      const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) ?? [];
      const calls = src.match(/requireAdmin\(/g) ?? [];
      expect(calls.length).toBeGreaterThanOrEqual(handlers.length);
    });
  }
});

describe("uploads", () => {
  it("re-encodes to WebP and strips EXIF/GPS", async () => {
    const src = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#c96" } })
      .jpeg().withExif({ IFD0: { Copyright: "secret-owner" } }).toBuffer();
    expect(src.includes(Buffer.from("secret-owner"))).toBe(true);
    const out = await sanitizeBuffer(src);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(out.includes(Buffer.from("secret-owner"))).toBe(false);
  });
  it("rejects non-images, SVG and scripts disguised as images", async () => {
    await expect(sanitizeBuffer(Buffer.from("<?php system($_GET['c']); ?>"))).rejects.toBeInstanceOf(UploadError);
    await expect(sanitizeBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).rejects.toBeInstanceOf(UploadError);
  });
  it("upload route needs auth", async () => {
    expect((await upload(req("POST"))).status).toBe(401);
  });
});

describe("orders CSV export", () => {
  it("neutralises spreadsheet formulas and requires auth", async () => {
    expect((await exportCsv(req("GET"))).status).toBe(401);
    await signedIn();
    await seedProduct({ id: "p1", stock: { M: 3 } });
    const { createPendingOrder } = await import("@/lib/orders");
    const { price, key } = await import("../support/helpers");
    const priced = await price([{ productId: "p1", size: "M", qty: 1 }]);
    await createPendingOrder({ priced, customer: { ...customer, name: "=HYPERLINK(\"http://evil\")" }, address, checkoutKey: key(1) });
    const text = await (await exportCsv(req("GET"))).text();
    expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(text).not.toMatch(/,"=HYPERLINK/);
    expect((await db.orders.all(5)).length).toBe(1);
  });
});

describe("rate limiter", () => {
  it("counts per key and window", async () => {
    const r = [];
    for (let i = 0; i < 4; i++) r.push((await rateLimit("k", 3, 60)).ok);
    expect(r).toEqual([true, true, true, false]);
    expect((await rateLimit("other", 3, 60)).ok).toBe(true);
  });
});
