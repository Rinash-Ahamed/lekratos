"use client";

import { useMemo, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { dateTimeLabel, inr } from "@/lib/format";
import { Modal } from "../Modal";
import { api } from "./api";
import { Empty, Field, Loading, Pill, Table, useConfirm, useData, useToast } from "./ui";

const STATUSES: OrderStatus[] = ["pending", "payment_pending", "confirmed", "packed", "shipped", "delivered", "payment_rejected", "review", "expired", "cancelled", "refunded", "paid", "failed"];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { confirmed: "packed", paid: "packed", packed: "shipped", shipped: "delivered" };
const tone = (s: OrderStatus) => (["confirmed", "paid", "packed", "shipped", "delivered"].includes(s) ? "ok" : ["payment_pending", "review", "payment_rejected", "failed"].includes(s) ? "warn" : "neutral") as "ok" | "warn" | "neutral";

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
  const flagged = (x: Order) => x.status === "review" || x.paymentStatus === "verification_pending" || (x.extraPayments ?? []).some((e) => !e.refundId);

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
      <p className="mt-2 text-sm text-muted">UPI submissions require a bank/UPI-account check. A reference or screenshot never confirms an order automatically.</p>
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
  const [busy, setBusy] = useState(false);
  const paid = ["confirmed", "paid", "packed", "shipped", "delivered"].includes(order.status);

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
          {order.paymentReference && <div className="admin-payment-reference"><p className="eyebrow text-muted">UPI reference</p><strong className="select-all">{order.paymentReference}</strong><p className="mt-1 text-xs text-muted">Submitted {order.paymentSubmittedAt ? dateTimeLabel(order.paymentSubmittedAt) : "—"}</p>{order.paymentScreenshotKey && <a className="btn btn-ghost mt-3 !min-h-10" href={`/api/admin/orders/${encodeURIComponent(order.id)}/payment-proof`} target="_blank" rel="noopener">View payment screenshot ↗</a>}</div>}
          {order.status === "review" && <p role="alert" className="border border-accent-text p-3 text-accent-text">{order.paid ? "Payment was verified, but stock could not be allocated. Contact the customer and resolve this manually." : "The stock hold expired while payment verification was pending. Verify the receiving account first; stock will be checked again before confirmation."}</p>}
        </section>

        <section className="space-y-6">
          {order.paymentStatus === "verification_pending" && (
            <div className="border border-accent-text bg-accent/20 p-4">
              <h3 className="serif text-2xl">Payment verification</h3>
              <p className="mt-2 text-sm">Check the exact amount <strong>{inr(order.total)}</strong> and UPI reference in the receiving account before taking action.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-solid" disabled={busy} onClick={async () => { if (await ask("Verify this payment?", "Only continue after confirming the exact payment in the bank or UPI account. The order will be confirmed if stock is still allocated.", "Verify payment")) await act({ action: "verify_payment" }, "Payment verified"); }}>Verify payment</button>
                <button className="btn btn-ghost" disabled={busy} onClick={async () => { const reason = window.prompt("Why is this payment being rejected?"); if (reason?.trim()) await act({ action: "reject_payment", reason: reason.trim() }, "Payment rejected and stock released"); }}>Reject payment</button>
              </div>
            </div>
          )}
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
