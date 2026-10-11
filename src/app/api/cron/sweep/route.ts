import { json } from "@/lib/api";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/ids";
import { sweepExpired } from "@/lib/orders";

/** Schedule every ~5 minutes (e.g. Vercel Cron). Requires `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = env.cronSecret();
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqual(got, secret)) return json({ error: "Unauthorized" }, 401);
  return json(await sweepExpired());
}
