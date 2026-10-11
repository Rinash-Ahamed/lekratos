import "server-only";
import path from "path";
import { env, isBuildPhase, isProd } from "../env";
import { firestore } from "../firebase-admin";
import type { Db } from "./db";
import { createFirestoreDb } from "./firestore";
import { createJsonDb } from "./json";
import { seedTables } from "./seed-tables";

declare global {
  var __lkDb: Db | undefined;
}

/** Process-wide database handle (survives dev hot reloads). */
export function getDb(): Db {
  if (globalThis.__lkDb) return globalThis.__lkDb;
  const backend = env.dataBackend();
  let db: Db;
  if (backend === "firestore") {
    db = createFirestoreDb(firestore());
  } else {
    if (isProd() && !isBuildPhase() && !env.allowJsonInProduction()) {
      throw new Error(
        "Refusing to use the local JSON store in production. Configure Firebase (DATA_BACKEND=firestore) — or set ALLOW_JSON_IN_PRODUCTION=1 for a single-instance trial.",
      );
    }
    db = createJsonDb(process.env.JSON_DATA_DIR ?? path.join(process.cwd(), ".data"), seedTables());
  }
  globalThis.__lkDb = db;
  return db;
}

/** Test helper */
export function setDbForTests(db: Db | undefined) {
  globalThis.__lkDb = db;
}
