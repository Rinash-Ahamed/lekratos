import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { bucket } from "./firebase-admin";
import { env, isProd } from "./env";
import { randomToken } from "./ids";

/**
 * Controlled image storage.
 *  - every upload is DECODED and RE-ENCODED with sharp (WebP, EXIF/GPS stripped, ≤2400px) – a file that
 *    isn't a real raster image is rejected; polyglot/oversized-pixel files can't survive re-encoding
 *  - product images: public (CDN-cacheable) · customer attachments: PRIVATE, only reachable through
 *    authenticated admin routes (short-lived signed URL / streamed bytes)
 *  - backend: Firebase Storage in production, local disk in development
 */
export class UploadError extends Error {}

export const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp", "avif"]);

export async function sanitizeImage(file: File, maxBytes: number): Promise<Buffer> {
  if (!(file instanceof File) || file.size === 0) throw new UploadError("Choose an image to upload");
  if (file.size > maxBytes) throw new UploadError(`Image must be under ${Math.round(maxBytes / 1024 / 1024)} MB`);
  return sanitizeBuffer(Buffer.from(await file.arrayBuffer()));
}

export async function sanitizeBuffer(input: Buffer): Promise<Buffer> {
  try {
    const img = sharp(input, { limitInputPixels: 50_000_000, failOn: "error" });
    const meta = await img.metadata();
    if (!meta.format || !ALLOWED.has(meta.format)) throw new UploadError("Only JPG, PNG, WebP or AVIF images are allowed");
    if ((meta.pages ?? 1) > 1) throw new UploadError("Animated images aren't supported");
    return await img
      .rotate() // apply EXIF orientation, then metadata is dropped on output
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (e) {
    if (e instanceof UploadError) throw e;
    throw new UploadError("That file couldn't be read as an image");
  }
}

/** Local (development / single-instance) storage lives next to the JSON data, NOT in public/ (files added to public/ after a build aren't served). */
export const localDataDir = () => process.env.JSON_DATA_DIR ?? path.join(process.cwd(), ".data");
export const localUploadsDir = () => path.join(localDataDir(), "uploads", "products");

const firebaseEnabled = () => env.dataBackend() === "firestore" && !!env.storageBucket();

function guardLocalInProd() {
  if (isProd() && !env.allowJsonInProduction() && !firebaseEnabled()) {
    throw new UploadError("Image storage isn't configured (set FIREBASE_STORAGE_BUCKET).");
  }
}

/** Saves a public product image and returns its URL. */
export async function saveProductImage(file: File): Promise<string> {
  return storeProductImage(await sanitizeImage(file, PRODUCT_IMAGE_MAX_BYTES));
}
export async function saveProductImageBuffer(buf: Buffer): Promise<string> {
  return storeProductImage(await sanitizeBuffer(buf));
}

async function storeProductImage(data: Buffer): Promise<string> {
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
  if (firebaseEnabled()) {
    const token = crypto.randomUUID();
    const f = bucket().file(`products/${name}`);
    await f.save(data, {
      contentType: "image/webp",
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000, immutable", metadata: { firebaseStorageDownloadTokens: token } },
    });
    return `https://firebasestorage.googleapis.com/v0/b/${bucket().name}/o/${encodeURIComponent(`products/${name}`)}?alt=media&token=${token}`;
  }
  guardLocalInProd();
  const dir = localUploadsDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), data);
  return `/uploads/products/${name}`;
}

/** Saves a private customer attachment; returns an opaque storage key (never a URL). */
export async function savePrivateAttachment(file: File): Promise<string> {
  return storePrivate(await sanitizeImage(file, ATTACHMENT_MAX_BYTES));
}
export async function savePrivateAttachmentBuffer(buf: Buffer): Promise<string> {
  return storePrivate(await sanitizeBuffer(buf));
}

async function storePrivate(data: Buffer): Promise<string> {
  const key = `enquiries/${Date.now()}-${randomToken(9)}.webp`;
  if (firebaseEnabled()) {
    await bucket().file(key).save(data, { contentType: "image/webp", resumable: false, private: true });
    return key;
  }
  guardLocalInProd();
  const file_ = path.join(localDataDir(), "private", key);
  await fs.mkdir(path.dirname(file_), { recursive: true });
  await fs.writeFile(file_, data);
  return key;
}

const KEY_RE = /^enquiries\/[0-9]+-[A-Za-z0-9_-]+\.webp$/;

/** Admin-only read. Returns either a short-lived signed URL (cloud) or the bytes (local). */
export async function readPrivateAttachment(key: string): Promise<{ url: string } | { bytes: Buffer }> {
  if (!KEY_RE.test(key)) throw new UploadError("Invalid attachment");
  if (firebaseEnabled()) {
    const [url] = await bucket().file(key).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 5 * 60_000 });
    return { url };
  }
  return { bytes: await fs.readFile(path.join(localDataDir(), "private", key)) };
}
