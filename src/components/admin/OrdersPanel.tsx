"use client";

import { useMemo, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { dateTimeLabel, inr } from "@/lib/format";
import { Modal } from "../Modal";
import { api } from "./api";
import { Empty, Field, Loading, Pill, Table, useConfirm, useData, useToast } from "./ui";

const STATUSES: OrderStatus[] = ["pending", "paid", "packed", "shipped", "delivered", "review", "failed", "expired", "cancelled", "refunded"];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { paid: "packed", packed: "shipped", shipped: "delivered" };
const tone = (s: OrderStatus) => (["paid", "packed", "shipped", "delivered"].includes(s) ? "ok" : ["review", "failed"].includes(s) ? "warn" : "neutral") as "ok" | "warn" | "neutral";

export default function OrdersPanel() {
  const o = useData<Order[]>("orders");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => (o.data ?? []).filter((x) => {
    if (status && x.status !== status) return false;
    const s = q.trim().toLowerCase();
    return !s || [x.id, x.customer.name, x.customer.phone, x.customer.email].some((v) => v.toLowerCase().includes(s));
  }), [o.data, q, status]);

  if (!o.data) return <Loading error={o.error} retry={o.reload} />;
  const current = o.data.find((x) => x.id === open) ?? null;
  const flagged = (x: Order) => x.status === "review" || (x.extraPayments ?? []).some((e) => !e.refundId);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="serif mr-auto text-3xl">Orders <span className="text-base text-muted">({rows.length})</span></h2>
        <label className="sr-only" htmlFor="oq">Search orders</label>
        <input id="oq" type="search" className="input max-w-[16rem]" placeholder="ID, name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="os">Status</label>
        <select id="os" className="input max-w-[11rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* eslint-disable-next-line no-restricted-syntax -- file download from an API route, not a page navigation */}
        <a className="btn btn-ghost" href="/api/admin/orders/export" download>Export CSV</a>
      </div>
      <p className="mt-2 text-sm text-muted">Unpaid checkouts hold stock for a short time, then are released automatically.</p>
      <div className="mt-6">
        {rows.length === 0 ? <Empty>{o.data.length ? "No orders match." : "No orders yet."}</Empty> : (
          <Table caption="Orders" head={["Order", "Customer", "Total", "Status", "Placed", ""]}>
            {rows.map((x) => (
              <tr key={x.id}>
                <td className="px-3 py-3 font-mono text-xs">{x.id}</td>
                <td className="px-3">{x.customer.name}<br /><span className="text-xs text-muted">{x.customer.phone}</span></td>
                <td className="px-3">{inr(x.total)}{x.refundedTotal ? <span className="block text-xs text-muted">refunded {inr(x.refundedTotal)}</span> : null}</td>
                <td className="px-3"><Pill tone={tone(x.status)}>{x.status}</Pill>{flagged(x) && <span className="ml-1 text-accent-text" title="Needs attention">⚠</span>}</td>
                <td className="px-3 text-xs text-muted">{dateTimeLabel(x.createdAt)}</td>
                <td className="px-3"><button className="btn btn-ghost !min-h-10 !px-3" onClick={() => setOpen(x.id)}>Open</button></td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      {current && <OrderModal order={current} onClose={() => setOpen(null)} onChanged={o.reload} />}
    </div>
  );
}

function OrderModal({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const say = useToast();
  const { ask, dialog } = useConfirm();
  const [note, setNote] = useState(order.adminNote ?? "");
  const [track, setTrack] = useState(order.trackingNote ?? "");
  const [refundAmt, setRefundAmt] = useState("");
  const [restock, setRestock] = useState(false);
  const [busy, setBusy] = useState(false);
  const paid = ["paid", "packed", "shipped", "delivered"].includes(order.status);
  const refundable = order.total - (order.refundedTotal ?? 0);

  const act = async (body: object, ok: string) => {
    setBusy(true);
    try { await api(`orders/${encodeURIComponent(order.id)}/action`, "POST", body); say(ok); onChanged(); }
    catch (e) { say(e instanceof Error ? e.message : "Failed", "error"); }
    setBusy(false);
  };
  const next = NEXT[order.status];

  return (
    <Modal open onClose={onClose} title={`Order ${order.id}`} wide>
      {dialog}
      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-3 text-sm">
          <p><Pill tone={tone(order.status)}>{order.status}</Pill> {order.paid ? "paid" : "unpaid"} · {dateTimeLabel(order.createdAt)}</p>
          <p><strong>{order.customer.name}</strong><br />{order.customer.phone} · {order.customer.email}</p>
          <p>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}<br />{order.address.city}, {order.address.state} {order.address.pincode}</p>
          <ul className="divide-y divide-line border-y hairline">{order.items.map((i, k) => <li key={k} className="flex justify-between py-2"><span>{i.qty} × {i.name} <span className="text-muted">· {i.color} · {i.size}</span></span><span>{inr(i.price * i.qty)}</span></li>)}</ul>
          <dl className="space-y-1"><div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{inr(order.subtotal)}</dd></div>{order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount {order.couponCode}</dt><dd>− {inr(order.discount)}</dd></div>}<div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{inr(order.shipping)}</dd></div><div className="flex justify-between font-semibold"><dt>Total</dt><dd>{inr(order.total)}</dd></div></dl>
          {order.razorpayPaymentId && <p className="break-all text-xs text-muted">Payment {order.razorpayPaymentId}{order.payment?.method ? ` · ${order.payment.method}` : ""}</p>}
          {(order.extraPayments ?? []).length > 0 && <p role="alert" className="border border-accent-text p-3 text-accent-text">Duplicate payment detected: {order.extraPayments!.map((e) => `${e.id} (${e.refundId ? "refunded" : "refund pending"})`).join(", ")}</p>}
          {order.status === "review" && <p role="alert" className="border border-accent-text p-3 text-accent-text">Paid after the stock hold expired and stock could not be re-reserved. Refund the order or fulfil it manually.</p>}
        </section>

        <section className="space-y-6">
          {paid && (
            <div>
              <h3 className="eyebrow mb-2 text-muted">Fulfilment</h3>
              <Field label="Tracking note shown to customer"><input className="input" value={track} maxLength={300} onChange={(e) => setTrack(e.target.value)} /></Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {next && <button className="btn btn-solid" disabled={busy} onClick={() => act({ action: "fulfil", status: next, trackingNote: track }, `Marked ${next}`)}>Mark {next}</button>}
                <button className="btn btn-ghost" disabled={busy} onClick={() => act({ action: "fulfil", status: order.status, trackingNote: track }, "Note saved")}>Save note</button>
              </div>
            </div>
          )}
          {order.status === "pending" && (
            <button className="btn btn-ghost" disabled={busy} onClick={async () => { if (await ask("Cancel this unpaid order?", "The held stock is released. If the customer pays afterwards the payment is flagged for refund.", "Cancel order")) await act({ action: "cancel" }, "Order cancelled"); }}>Cancel unpaid order</button>
          )}
          {(paid || order.status === "review") && refundable > 0 && (
            <div>
              <h3 className="eyebrow mb-2 text-muted">Refund (max {inr(refundable)})</h3>
              <Field label="Amount ₹ (blank = full remaining)"><input className="input" inputMode="numeric" value={refundAmt} onChange={(e) => setRefundAmt(e.target.value.replace(/\D/g, ""))} /></Field>
              <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Return items to stock (full refunds only)</label>
              <button className="btn btn-ghost mt-3" disabled={busy} onClick={async () => {
                const amt = refundAmt ? Number(refundAmt) : undefined;
                if (amt !== undefined && (amt < 1 || amt > refundable)) return say(`Enter an amount between ₹1 and ₹${refundable}`, "error");
                if (await ask("Issue refund?", `${inr(amt ?? refundable)} will be sent back to the customer through Razorpay. This can't be undone.`, "Refund"))
                  await act({ action: "refund", amount: amt, restock }, "Refund issued");
              }}>Refund via Razorpay</button>
            </div>
          )}
          <div>
            <h3 className="eyebrow mb-2 text-muted">Internal note</h3>
            <textarea className="input" rows={3} aria-label="Internal note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-ghost mt-2" disabled={busy} onClick={() => act({ action: "note", adminNote: note }, "Note saved")}>Save note</button>
          </div>
          {(order.events ?? []).length > 0 && (
            <details><summary className="eyebrow cursor-pointer text-muted">History</summary>
              <ul className="mt-2 space-y-1 text-xs text-muted">{order.events!.map((e, i) => <li key={i}>{dateTimeLabel(e.at)} — {e.type}{e.note ? ` (${e.note})` : ""}</li>)}</ul>
            </details>
          )}
        </section>
      </div>
    </Modal>
  );
}
