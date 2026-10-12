import type { Metadata } from "next";
import { OrderStatus } from "@/components/OrderStatus";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  return (
    <div className="wrap pb-24 pt-12 md:pt-20">
      <OrderStatus id={id} token={t ?? ""} />
    </div>
  );
}
