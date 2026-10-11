"use client";

import { inr } from "@/lib/format";
import { Loading, Pill, useData } from "./ui";

interface Analytics {
  revenue: number; orders: number; units: number; aov: number;
  top: { name: string; units: number; revenue: number }[];
  daily: { date: string; total: number }[];
  lowStock: { name: string; color: string; size: string; stock: number }[];
  soldOutVariants: number; newEnquiries: number; needsAttention: number; pending: number;
}
interface Check { key: string; label: string; ok: boolean; level: "required" | "recommended"; hint: string }

export default function OverviewPanel() {
  const a = useData<Analytics>("analytics");
  const r = useData<Check[]>("readiness");
  if (!a.data) return <Loading error={a.error} retry={a.reload} />;
  const d = a.data;
  const max = Math.max(1, ...d.daily.map((x) => x.total));
  const todo = (r.data ?? []).filter((c) => !c.ok);
  return (
    <div className="space-y-10">
      {(d.needsAttention > 0 || d.newEnquiries > 0) && (
        <section aria-label="Needs attention" className="border border-accent-text p-5">
          <h2 className="serif text-2xl">Needs attention</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {d.needsAttention > 0 && <li><strong>{d.needsAttention}</strong> order(s) need a manual look (payment under review or a duplicate payment) — see Orders.</li>}
            {d.newEnquiries > 0 && <li><strong>{d.newEnquiries}</strong> new enquir{d.newEnquiries === 1 ? "y" : "ies"} waiting for a reply.</li>}
          </ul>
        </section>
      )}

      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["Net revenue", inr(d.revenue)], ["Paid orders", String(d.orders)], ["Units sold", String(d.units)], ["Average order", inr(d.aov)]].map(([k, v]) => (
          <div key={k} className="border hairline bg-surface p-5"><p className="eyebrow text-muted">{k}</p><p className="serif mt-2 text-3xl">{v}</p></div>
        ))}
      </section>

      <section aria-label="Last 14 days" className="border hairline bg-surface p-5">
        <h2 className="serif text-xl">Net revenue, last 14 days</h2>
        <div className="mt-6 flex h-40 items-end gap-1" role="img" aria-label={`Daily net revenue; highest ${inr(max)}`}>
          {d.daily.map((x) => (
            <div key={x.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${x.date}: ${inr(x.total)}`}>
              <div className="w-full bg-accent-text" style={{ height: `${Math.max(2, (x.total / max) * 100)}%`, opacity: x.total ? 1 : 0.25 }} />
              <span className="text-[10px] text-muted">{x.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-label="Best sellers">
          <h2 className="serif text-xl">Top products</h2>
          {d.top.length === 0 ? <p className="mt-3 text-muted">No paid orders yet.</p> : (
            <ol className="mt-3 divide-y divide-line border-y hairline">{d.top.map((t) => <li key={t.name} className="flex justify-between py-3 text-sm"><span>{t.name} <span className="text-muted">· {t.units} sold</span></span><span>{inr(t.revenue)}</span></li>)}</ol>
          )}
        </section>
        <section aria-label="Low stock">
          <h2 className="serif text-xl">Low stock <span className="text-sm text-muted">({d.soldOutVariants} variants sold out)</span></h2>
          {d.lowStock.length === 0 ? <p className="mt-3 text-muted">Nothing running low.</p> : (
            <ul className="mt-3 divide-y divide-line border-y hairline">{d.lowStock.map((l, i) => <li key={i} className="flex justify-between py-3 text-sm"><span>{l.name} · {l.color} · {l.size}</span><Pill tone="warn">{l.stock} left</Pill></li>)}</ul>
          )}
        </section>
      </div>

      <section aria-label="Launch checklist">
        <h2 className="serif text-xl">Launch checklist {r.data && <span className="text-sm text-muted">({r.data.length - todo.length}/{r.data.length} done)</span>}</h2>
        {!r.data ? <Loading error={r.error} retry={r.reload} /> : (
          <ul className="mt-3 divide-y divide-line border-y hairline">
            {r.data.map((c) => (
              <li key={c.key} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <div><span aria-hidden>{c.ok ? "✓" : "○"}</span> <span className={c.ok ? "" : "font-semibold"}>{c.label}</span>{!c.ok && <p className="ml-5 text-muted">{c.hint}</p>}</div>
                <Pill tone={c.ok ? "ok" : c.level === "required" ? "warn" : "neutral"}>{c.ok ? "Done" : c.level}</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
