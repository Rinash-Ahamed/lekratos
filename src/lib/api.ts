import "server-only";
import { forbidden, ipHash, rateLimit, sameOrigin, tooMany } from "./security";

/** Common guard for public mutating endpoints: same-origin + persistent per-IP rate limit. */
export async function publicGuard(req: Request, bucket: string, limit: number, windowSec: number): Promise<Response | null> {
  if (!sameOrigin(req)) return forbidden("Cross-site request blocked");
  const rl = await rateLimit(`${bucket}:${ipHash(req)}`, limit, windowSec);
  return rl.ok ? null : tooMany(rl.retryAfter);
}

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
