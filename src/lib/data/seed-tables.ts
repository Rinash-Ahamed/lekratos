import "server-only";
import { sampleCollections, sampleProducts } from "@/data/seed";
import type { Col } from "./db";

/** Initial content for the local JSON development store only. */
export function seedTables(): Partial<Record<Col, Record<string, object>>> {
  return {
    products: Object.fromEntries(sampleProducts.map((p) => [p.id, p])),
    collections: Object.fromEntries(sampleCollections.map((c) => [c.slug, c])),
  };
}
