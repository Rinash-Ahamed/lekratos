import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env } from "./env";

let app: App | undefined;

function getApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) return (app = existing);
  const c = env.firebase();
  if (!c) throw new Error("Firebase credentials are not configured (FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY).");
  const credential = c.kind === "json" ? cert(JSON.parse(c.json)) : cert({ projectId: c.projectId, clientEmail: c.clientEmail, privateKey: c.privateKey });
  app = initializeApp({ credential, storageBucket: env.storageBucket() });
  return app;
}

let fs: Firestore | undefined;
export function firestore(): Firestore {
  if (!fs) {
    fs = getFirestore(getApp());
    fs.settings({ ignoreUndefinedProperties: true });
  }
  return fs;
}

export function bucket() {
  const name = env.storageBucket();
  if (!name) throw new Error("FIREBASE_STORAGE_BUCKET is not configured");
  return getStorage(getApp()).bucket(name);
}
