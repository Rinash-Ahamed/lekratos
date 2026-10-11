import { revalidateTag } from "next/cache";

/**
 * Immediately expires tagged cache entries (Next 16 requires a cache profile; `expire: 0`
 * means "don't serve stale", which is what we want after an admin edit or a stock change).
 * Safe to call outside a Next request (unit tests): the call is simply ignored there.
 */
export function bustCache(...tags: string[]) {
  for (const t of tags) {
    try {
      revalidateTag(t, { expire: 0 });
    } catch {
      /* not running inside Next */
    }
  }
}
