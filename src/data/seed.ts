import type { ArtKind, Collection, Product, Size, Variant } from "@/lib/types";

/**
 * SAMPLE data used only by the local JSON development store so the storefront
 * has something to render. Every product is flagged `sample: true`, labelled in
 * the UI, and contains no fabric/fit/care claims. Delete them in Admin → Products
 * once real designs are added. The Firestore backend is never auto-seeded.
 */
export const sampleCollections: Collection[] = [
  { slug: "sample-collection-a", name: "Sample Collection A", blurb: "Placeholder collection — rename in Admin → Collections." },
  { slug: "sample-collection-b", name: "Sample Collection B", blurb: "Placeholder collection — rename in Admin → Collections." },
];

const COLORS = {
  ivory: { name: "Ivory", hex: "#EADFCB" },
  espresso: { name: "Espresso", hex: "#2A211E" },
  terracotta: { name: "Terracotta", hex: "#8A4A33" },
  sand: { name: "Sand", hex: "#CDB08C" },
};

function variants(colors: string[], stock: Partial<Record<Size, number>>): Variant[] {
  return colors.flatMap((color) =>
    (["XS", "S", "M", "L", "XL", "XXL"] as Size[]).map((size) => ({ color, size, stock: stock[size] ?? 0 })),
  );
}

const iso = (daysAgo: number) => new Date(Date.UTC(2026, 8, 30 - daysAgo)).toISOString();

function sample(
  n: number,
  collection: string,
  price: number,
  kind: ArtKind,
  colors: (keyof typeof COLORS)[],
  tags: Product["tags"],
  featured = false,
  stock: Partial<Record<Size, number>> = { S: 5, M: 8, L: 8, XL: 4 },
): Product {
  const name = `Sample Tee ${String(n).padStart(2, "0")}`;
  return {
    id: `sample-${n}`,
    slug: `sample-tee-${String(n).padStart(2, "0")}`,
    name,
    collection,
    price,
    description: "",
    story: "Sample product — replace with your own design, description and photography.",
    colors: colors.map((c) => COLORS[c]),
    variants: variants(colors.map((c) => COLORS[c].name), stock),
    images: [],
    art: { kind, seed: n * 7 + 3 },
    tags,
    featured,
    sample: true,
    createdAt: iso(n * 3),
    published: true,
  };
}

export const sampleProducts: Product[] = [
  sample(1, "sample-collection-a", 1499, "sun", ["ivory", "espresso"], ["new", "trending"], true),
  sample(2, "sample-collection-b", 1499, "grid", ["espresso", "sand"], ["bestseller"], true),
  sample(3, "sample-collection-a", 1599, "wave", ["ivory", "terracotta"], ["bestseller", "trending"], true),
  sample(4, "sample-collection-b", 1699, "eye", ["espresso", "terracotta"], ["new", "limited"], false, { S: 1, M: 2, L: 2 }),
  sample(5, "sample-collection-a", 1599, "bloom", ["sand", "terracotta", "ivory"], ["new"]),
  sample(6, "sample-collection-b", 1399, "stripe", ["sand", "espresso"], ["bestseller"]),
];
