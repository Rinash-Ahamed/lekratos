import { beforeEach, describe, expect, it } from "vitest";
import { createJsonDb } from "@/lib/data/json";
import type { Db } from "@/lib/data/db";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let db: Db;
beforeEach(() => {
  db = createJsonDb(fs.mkdtempSync(path.join(os.tmpdir(), "lk-db-")));
});

describe("Db adapter contract (JSON adapter)", () => {
  it("create() is create-if-absent", async () => {
    expect(await db.create("offers", "a", { n: 1 })).toBe(true);
    expect(await db.create("offers", "a", { n: 2 })).toBe(false);
    expect(await db.get("offers", "a")).toEqual({ n: 1 });
  });

  it("list() supports where / orderBy / limit", async () => {
    for (const [i, status] of ["x", "y", "x", "x"].entries()) await db.set("orders", `o${i}`, { id: `o${i}`, status, createdAt: `2026-01-0${i + 1}` });
    const xs = await db.list<{ id: string }>("orders", { where: [{ field: "status", op: "==", value: "x" }], orderBy: { field: "createdAt", dir: "desc" }, limit: 2 });
    expect(xs.map((o) => o.id)).toEqual(["o3", "o2"]);
    const lt = await db.list<{ id: string }>("orders", { where: [{ field: "createdAt", op: "<", value: "2026-01-03" }] });
    expect(lt.map((o) => o.id).sort()).toEqual(["o0", "o1"]);
  });

  it("returns copies, never live references", async () => {
    await db.set("offers", "a", { n: 1 });
    const a = await db.get<{ n: number }>("offers", "a");
    a!.n = 99;
    expect((await db.get<{ n: number }>("offers", "a"))!.n).toBe(1);
  });

  it("a transaction is atomic: throwing leaves no writes behind", async () => {
    await db.set("offers", "a", { n: 1 });
    await expect(
      db.tx(async (tx) => {
        const a = await tx.get<{ n: number }>("offers", "a");
        tx.set("offers", "a", { n: a!.n + 1 });
        tx.set("offers", "b", { n: 5 });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await db.get("offers", "a")).toEqual({ n: 1 });
    expect(await db.get("offers", "b")).toBeUndefined();
  });

  it("enforces Firestore's read-before-write rule", async () => {
    await expect(
      db.tx(async (tx) => {
        tx.set("offers", "a", { n: 1 });
        await tx.get("offers", "a");
      }),
    ).rejects.toThrow(/read after write/);
  });

  it("100 concurrent read-modify-write transactions lose no updates", async () => {
    await db.set("offers", "ctr", { n: 0 });
    await Promise.all(
      Array.from({ length: 100 }, () =>
        db.tx(async (tx) => {
          const c = await tx.get<{ n: number }>("offers", "ctr");
          tx.set("offers", "ctr", { n: c!.n + 1 });
        }),
      ),
    );
    expect((await db.get<{ n: number }>("offers", "ctr"))!.n).toBe(100);
  });

  it("persists to disk and reloads", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lk-db-"));
    await createJsonDb(dir).set("offers", "a", { n: 7 });
    expect(await createJsonDb(dir).get("offers", "a")).toEqual({ n: 7 });
  });
});
