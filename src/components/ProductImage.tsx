import Image from "next/image";
import type { Product } from "@/lib/types";
import { ArtTee } from "./ArtTee";

type Pick = Pick_<Product, "name" | "images" | "art" | "colors">;
type Pick_<T, K extends keyof T> = { [P in K]: T[P] };

/** Renders uploaded photography when present, otherwise the procedural artwork. */
export function ProductImage({
  product,
  colorIndex = 0,
  imageIndex = 0,
  className = "",
  priority = false,
  sizes = "(min-width:1024px) 40vw, 90vw",
}: {
  product: Pick;
  colorIndex?: number;
  imageIndex?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const src = product.images[imageIndex] ?? product.images[0];
  if (src) {
    return (
      <Image
        src={src}
        alt={product.name}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${className}`}
      />
    );
  }
  const color = product.colors[colorIndex]?.hex ?? product.colors[0]?.hex ?? "#E9E4D8";
  return (
    <ArtTee
      kind={product.art.kind}
      seed={product.art.seed}
      color={color}
      label={product.name}
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
}
