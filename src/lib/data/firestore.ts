import "server-only";
import type { Firestore, Query } from "firebase-admin/firestore";
import type { Col, Db, QueryOpts, Tx } from "./db";

/**
 * Firestore adapter (firebase-admin, server-side only).
 * Clients never talk to Firestore directly – security rules deny all client access (see firestore.rules).
 */
export function createFirestoreDb(fs: Firestore): Db {
  const ref = (c: Col, id: string) => fs.collection(c).doc(id);

  return {
    async get<T>(c: Col, id: string) {
      const s = await ref(c, id).get();
      return s.exists ? (s.data() as T) : undefined;
    },

    async list<T>(c: Col, q?: QueryOpts) {
      let query: Query = fs.collection(c);
      for (const w of q?.where ?? []) query = query.where(w.field, w.op, w.value);
      if (q?.orderBy) query = query.orderBy(q.orderBy.field, q.orderBy.dir);
      if (q?.limit) query = query.limit(q.limit);
      return (await query.get()).docs.map((d) => d.data() as T);
    },

    async set(c, id, data) {
      await ref(c, id).set(data);
    },

    async create(c, id, data) {
      try {
        await ref(c, id).create(data);
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === 6) return false; // ALREADY_EXISTS
        throw e;
      }
    },

    async delete(c, id) {
      await ref(c, id).delete();
    },

    tx: <T>(fn: (tx: Tx) => Promise<T>) =>
      fs.runTransaction(async (t) => {
        const tx: Tx = {
          async get<U>(c: Col, id: string) {
            const s = await t.get(ref(c, id));
            return s.exists ? (s.data() as U) : undefined;
          },
          set(c, id, data) {
            t.set(ref(c, id), data);
          },
          delete(c, id) {
            t.delete(ref(c, id));
          },
        };
        return fn(tx);
      }),
  };
}
