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
          <div className="glass rounded-xl border hairline p-6 my-4 shadow-2xs">
            <dl className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-y-3.5 gap-x-4">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="eyebrow text-muted sm:self-center">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p>Delivery timelines will be published here shortly. For anything urgent, <Link href="/contact" className="link-underline">contact us</Link> before ordering.</p>
        )}
        <p className="mt-4">Track an order any time on the <Link href="/track" className="link-underline">Track order</Link> page.</p>
      </section>

      <div className="section-line my-10" />

      <section id="size">
        <h2>Size guide</h2>
        {s.sizeChart ? (
          <div className="glass rounded-xl border hairline p-4 sm:p-6 overflow-x-auto my-6 shadow-2xs">
            <table className="w-full border-collapse text-left text-base">
              <caption className="mb-4 text-left eyebrow text-muted">Garment measurements in {s.sizeChart.unit === "in" ? "inches" : "centimetres"}</caption>
              <thead>
                <tr className="eyebrow border-b-2 hairline text-accent-text">
                  <th scope="col" className="py-3.5 pr-4">Size</th>
                  {s.sizeChart.columns.map((c) => <th key={c} scope="col" className="pr-4 py-3.5">{c}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {s.sizeChart.rows.map((r) => (
                  <tr key={r.size} className="transition-colors hover:bg-surface/50">
                    <th scope="row" className="py-3.5 pr-4 font-semibold">{r.size}</th>
                    {r.values.map((v, i) => <td key={i} className="pr-4 py-3.5">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>The measurement chart will be added soon. Each product page lists fit notes where available.</p>
        )}
      </section>
    </PolicyShell>
  );
}
