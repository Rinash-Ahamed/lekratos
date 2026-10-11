/**
 * Minimal document-database contract. Two adapters implement it:
 *   - firestore.ts  (production)
 *   - json.ts       (zero-setup local development / tests)
 * All business logic (repo.ts, inventory, orders…) is written once against this interface.
 */
export type Col =
  | "products"
  | "collections"
  | "orders"
  | "enquiries"
  | "offers"
  | "banners"
  | "subscribers"
  | "settings"
  | "auditLogs"
  | "rateLimits"
  | "webhookEvents"
  | "adminSessions";

export interface Where {
  field: string;
  op: "==" | "<" | "<=" | ">" | ">=";
  value: string | number | boolean;
}

export interface QueryOpts {
  where?: Where[];
  orderBy?: { field: string; dir: "asc" | "desc" };
  limit?: number;
}

/** Transaction handle. RULE: perform every `get` before the first `set`/`delete` (Firestore requirement). */
export interface Tx {
  get<T>(col: Col, id: string): Promise<T | undefined>;
  set(col: Col, id: string, data: object): void;
  delete(col: Col, id: string): void;
}

export interface Db {
  get<T>(col: Col, id: string): Promise<T | undefined>;
  list<T>(col: Col, q?: QueryOpts): Promise<T[]>;
  set(col: Col, id: string, data: object): Promise<void>;
  /** Creates only if the id doesn't exist. Returns false when it already existed. */
  create(col: Col, id: string, data: object): Promise<boolean>;
  delete(col: Col, id: string): Promise<void>;
  tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export function matches(doc: Record<string, unknown>, where?: Where[]): boolean {
  return (where ?? []).every((w) => {
    const v = doc[w.field] as string | number | boolean | undefined;
    if (v === undefined) return false;
    switch (w.op) {
      case "==": return v === w.value;
      case "<": return v < w.value;
      case "<=": return v <= w.value;
      case ">": return v > w.value;
      case ">=": return v >= w.value;
    }
  });
}
