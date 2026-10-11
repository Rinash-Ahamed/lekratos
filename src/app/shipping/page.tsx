import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { PolicyShell } from "@/components/PolicyShell";

export const metadata: Metadata = { title: "Shipping & sizing", description: "Delivery times, shipping charges and the size guide.", alternates: { canonical: "/shipping" } };

export default async function Shipping() {
  const s = await getSettings();
  const sh = s.shipping;
  const rows = [
    sh.dispatchTime && ["Dispatch", sh.dispatchTime],
    sh.deliveryTime && ["Delivery", sh.deliveryTime],
    sh.coverage && ["Where we deliver", sh.coverage],
    ["Shipping charge", sh.flatRate ? `${inr(sh.flatRate)}${sh.freeAbove ? `, free on orders of ${inr(sh.freeAbove)} or more` : ""}` : sh.freeAbove ? `Free on orders of ${inr(sh.freeAbove)} or more` : "Free"],
  ].filter(Boolean) as string[][];
  const provided = !!(sh.dispatchTime || sh.deliveryTime || sh.coverage);
  return (
    <PolicyShell title="Shipping & sizing" reviewed={!!s.policiesReviewed || provided}>
      <section>
        <h2>Delivery</h2>
        {provided ? (
          <dl className="grid grid-cols-[10rem_1fr] gap-y-2">{rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>))}</dl>
        ) : (
          <p>Delivery timelines will be published here shortly. For anything urgent, <Link href="/contact" className="link-underline">contact us</Link> before ordering.</p>
        )}
        <p>Track an order any time on the <Link href="/track" className="link-underline">Track order</Link> page.</p>
      </section>
      <section id="size">
        <h2>Size guide</h2>
        {s.sizeChart ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-base">
              <caption className="mb-2 text-left text-muted">Garment measurements in {s.sizeChart.unit === "in" ? "inches" : "centimetres"}</caption>
              <thead><tr className="eyebrow border-b hairline"><th scope="col" className="py-3 pr-4">Size</th>{s.sizeChart.columns.map((c) => <th key={c} scope="col" className="pr-4">{c}</th>)}</tr></thead>
              <tbody>{s.sizeChart.rows.map((r) => <tr key={r.size} className="border-b hairline"><th scope="row" className="py-3 pr-4">{r.size}</th>{r.values.map((v, i) => <td key={i} className="pr-4">{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : (
          <p>The measurement chart will be added soon. Each product page lists fit notes where available.</p>
        )}
      </section>
    </PolicyShell>
  );
}
