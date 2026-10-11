import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

/** Legacy URL kept for old links: forwards to the order page (or the tracker when there's no access token). */
export default async function Success({ searchParams }: { searchParams: Promise<{ id?: string; t?: string }> }) {
  const { id, t } = await searchParams;
  if (id && t) redirect(`/order/${encodeURIComponent(id)}?t=${encodeURIComponent(t)}`);
  redirect(id ? `/track?id=${encodeURIComponent(id)}` : "/track");
}
