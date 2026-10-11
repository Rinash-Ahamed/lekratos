import { json, publicGuard } from "@/lib/api";
import { priceCart } from "@/lib/pricing";
import { parseJson, priceBody } from "@/lib/schemas";

export async function POST(req: Request) {
  const blocked = await publicGuard(req, "price", 90, 60);
  if (blocked) return blocked;
  const p = await parseJson(req, priceBody);
  if ("res" in p) return p.res;
  const r = await priceCart(p.data.lines as never, p.data.code);
  return json(r, r.ok ? 200 : 422);
}
