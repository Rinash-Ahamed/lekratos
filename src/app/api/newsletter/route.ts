import { z } from "zod";
import { json, publicGuard } from "@/lib/api";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/schemas";

export async function POST(req: Request) {
  const blocked = await publicGuard(req, "newsletter", 5, 3600);
  if (blocked) return blocked;
  const p = await parseJson(req, z.object({ email: z.email().max(120) }));
  if ("res" in p) return p.res;
  await db.subscribers.add(p.data.email.toLowerCase());
  return json({ ok: true });
}
