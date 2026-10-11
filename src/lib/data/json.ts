import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { matches, type Col, type Db, type QueryOpts, type Tx } from "./db";

/**
 * File-backed adapter for local development and automated tests.
 * - one JSON file per collection: { [id]: document }
 * - all mutations are serialised through an in-process mutex and written atomically (tmp + rename)
 * - NOT suitable for serverless / multi-instance deployments (use the Firestore adapter there)
 */
type Table = Record<string, Record<string, unknown>>;

export function createJsonDb(dir: string, seed?: Partial<Record<Col, Record<string, object>>>): Db {
  const cache = new Map<Col, Table>();
  let chain: Promise<unknown> = Promise.resolve();

  const file = (c: Col) => path.join(dir, `${c}.json`);

  async function load(c: Col): Promise<Table> {
    const hit = cache.get(c);
    if (hit) return hit;
    let t: Table;
    try {
      t = JSON.parse(await fs.readFile(file(c), "utf8")) as Table;
    } catch {
      t = structuredClone((seed?.[c] ?? {}) as Table);
      if (Object.keys(t).length) await persist(c, t);
    }
    cache.set(c, t);
    return t;
  }

  async function persist(c: Col, t: Table) {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file(c)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(t, null, 2));
    await fs.rename(tmp, file(c));
  }

  /** run fn exclusively */
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  }

  const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

  const db: Db = {
    async get<T>(c: Col, id: string) {
      const t = await load(c);
      return clone(t[id]) as T | undefined;
    },

    async list<T>(c: Col, q?: QueryOpts) {
      const t = await load(c);
      let rows = Object.values(t).filter((d) => matches(d as Record<string, unknown>, q?.where));
      if (q?.orderBy) {
        const { field, dir } = q.orderBy;
        rows = rows.sort((a, b) => {
          const av = (a as Record<string, string | number>)[field];
          const bv = (b as Record<string, string | number>)[field];
          return (av < bv ? -1 : av > bv ? 1 : 0) * (dir === "desc" ? -1 : 1);
        });
      }
      if (q?.limit) rows = rows.slice(0, q.limit);
      return clone(rows) as T[];
    },

    set: (c, id, data) =>
      exclusive(async () => {
        const t = await load(c);
        t[id] = clone(data) as Record<string, unknown>;
        await persist(c, t);
      }),

    create: (c, id, data) =>
      exclusive(async () => {
        const t = await load(c);
        if (t[id]) return false;
        t[id] = clone(data) as Record<string, unknown>;
        await persist(c, t);
        return true;
      }),

    delete: (c, id) =>
      exclusive(async () => {
        const t = await load(c);
        delete t[id];
        await persist(c, t);
      }),

    tx: <T>(fn: (tx: Tx) => Promise<T>) =>
      exclusive(async () => {
        const writes: { op: "set" | "del"; c: Col; id: string; data?: object }[] = [];
        let wrote = false;
        const tx: Tx = {
          async get<U>(c: Col, id: string) {
            if (wrote) throw new Error("Transaction rule violated: read after write");
            const t = await load(c);
            // read-your-writes is NOT offered (matches Firestore); reads see committed state
            return clone(t[id]) as U | undefined;
          },
          set(c, id, data) {
            wrote = true;
            writes.push({ op: "set", c, id, data });
          },
          delete(c, id) {
            wrote = true;
            writes.push({ op: "del", c, id });
          },
        };
        const result = await fn(tx);
        const touched = new Set<Col>();
        for (const w of writes) {
          const t = await load(w.c);
          if (w.op === "set") t[w.id] = clone(w.data) as Record<string, unknown>;
          else delete t[w.id];
          touched.add(w.c);
        }
        for (const c of touched) await persist(c, (await load(c)));
        return result;
      }),
  };
  return db;
}
