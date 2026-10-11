import { promises as fs } from "fs";
import path from "path";
import { localUploadsDir } from "@/lib/storage";

const NAME = /^[0-9]+-[a-f0-9]{12}\.webp$/;

/** Serves product images saved by the LOCAL storage backend (Firebase Storage serves its own URLs in production). */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAME.test(name)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(localUploadsDir(), name));
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
