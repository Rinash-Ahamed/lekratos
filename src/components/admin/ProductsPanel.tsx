"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Collection, Product } from "@/lib/types";
import { inr } from "@/lib/format";
import { totalStock } from "@/lib/product";
import { api } from "./api";
import { ProductEditor } from "./ProductEditor";
import { Empty, Loading, Pill, Table, useConfirm, useData, useToast } from "./ui";

export default function ProductsPanel() {
  const p = useData<Product[]>("products");
  const c = useData<Collection[]>("collections");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "draft" | "archived" | "soldout" | "low">("all");
  const { ask, dialog } = useConfirm();
  const say = useToast();

  const rows = useMemo(() => (p.data ?? []).filter((x) => {
    if (q && !x.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "live") return x.published && (x.status ?? "active") === "active";
    if (filter === "draft") return !x.published || x.status === "draft";
    if (filter === "archived") return x.status === "archived";
    if (filter === "soldout") return x.manualSoldOut || x.status === "sold_out" || totalStock(x) === 0;
    if (filter === "low") return totalStock(x) <= 5;
    return true;
  }), [p.data, q, filter]);

  if (!p.data || !c.data) return <Loading error={p.error || c.error} retry={() => { p.reload(); c.reload(); }} />;
  if (editing)
    return <ProductEditor product={editing === "new" ? null : editing} collections={c.data} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); p.reload(); say("Product saved"); }} />;

  const toggle = async (x: Product) => {
    const published = !x.published;
    try { await api("products", "POST", { ...x, published, status: published ? (x.status === "sold_out" ? "sold_out" : "active") : "draft" }); say(x.published ? "Moved to drafts" : "Now visible"); p.reload(); }
    catch (e) { say(e instanceof Error ? e.message : "Failed", "error"); }
  };
  const remove = async (x: Product) => {
    if (!(await ask(`Delete “${x.name}”?`, "This permanently removes the product. Past orders keep their own copy of the item. Consider hiding it instead.", "Delete product"))) return;
    try { await api(`products?id=${encodeURIComponent(x.id)}`, "DELETE"); say("Product deleted"); p.reload(); }
    catch (e) { say(e instanceof Error ? e.message : "Failed", "error"); }
  };
  const duplicate = async (x: Product) => {
    try {
      const { id: _id, slug: _slug, createdAt: _createdAt, updatedAt: _updatedAt, ...copy } = x;
      await api("products", "POST", { ...copy, name: `${x.name} Copy`, sku: "", published: false, status: "draft", featured: false });
      say("Draft copy created"); p.reload();
    } catch (e) { say(e instanceof Error ? e.message : "Failed", "error"); }
  };
  const archive = async (x: Product) => {
    try { await api("products", "POST", { ...x, status: "archived", published: false }); say("Product archived"); p.reload(); }
    catch (e) { say(e instanceof Error ? e.message : "Failed", "error"); }
  };

  return (
    <div>
      {dialog}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="serif mr-auto text-3xl">Products <span className="text-base text-muted">({rows.length})</span></h2>
        <label className="sr-only" htmlFor="pq">Search products</label>
        <input id="pq" type="search" className="input max-w-[14rem]" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="pf">Filter</label>
        <select id="pf" className="input max-w-[11rem]" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All</option><option value="live">Active</option><option value="draft">Draft</option><option value="archived">Archived</option><option value="soldout">Sold out</option><option value="low">Low stock (≤5)</option>
        </select>
        <button className="btn btn-solid" onClick={() => setEditing("new")}>+ New product</button>
      </div>
      <div className="mt-6">
        {rows.length === 0 ? <Empty>{p.data.length ? "No products match." : "No products yet — add your first design."}</Empty> : (
          <Table caption="Products" head={["Product", "Price", "Stock", "Status", "Actions"]}>
            {rows.map((x) => (
              <tr key={x.id}>
                <td className="px-3 py-3"><div className="flex items-center gap-3">
                  {x.images[0] && <Image src={x.images[0]} alt="" width={40} height={48} unoptimized className="h-12 w-10 object-cover" />}
                  <div><p className="font-semibold">{x.name}</p><p className="text-xs text-muted">{x.sample ? "Sample · " : ""}{x.featured ? "Featured · " : ""}{x.collection}</p></div>
                </div></td>
                <td className="px-3">{inr(x.price)}</td>
                <td className="px-3">{totalStock(x) === 0 ? <Pill tone="warn">Sold out</Pill> : totalStock(x)}</td>
                <td className="px-3"><Pill tone={x.published && (x.status ?? "active") === "active" ? "ok" : x.manualSoldOut || x.status === "sold_out" ? "warn" : "neutral"}>{x.manualSoldOut ? "Sold out" : x.status ?? (x.published ? "active" : "draft")}</Pill></td>
                <td className="px-3"><div className="flex flex-wrap gap-1">
                  <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => setEditing(x)}>Edit</button>
                  {x.status !== "archived" && <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => toggle(x)}>{x.published ? "Draft" : "Publish"}</button>}
                  <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => duplicate(x)}>Duplicate</button>
                  {x.status !== "archived" && <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => archive(x)}>Archive</button>}
                  <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => remove(x)}>Delete</button>
                </div></td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
