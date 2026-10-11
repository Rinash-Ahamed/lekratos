import type { Product } from "./types";

export const inStock = (p: Product) => p.variants.some((v) => v.stock > 0);

export const stockFor = (p: Product, color: string, size: string) =>
  p.variants.find((v) => v.color === color && v.size === size)?.stock ?? 0;

export const totalStock = (p: Product) => p.variants.reduce((n, v) => n + v.stock, 0);

export const lowestPrice = (ps: Product[]) => Math.min(...ps.map((p) => p.price));
