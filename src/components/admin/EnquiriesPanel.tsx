"use client";

import { useMemo, useState } from "react";
import type { Enquiry } from "@/lib/types";
import { SIZES } from "@/lib/types";
import { dateLabel } from "@/lib/format";
import { Modal } from "../Modal";
import { api } from "./api";
import { Empty, Field, Loading, Pill, Table, useData, useToast } from "./ui";

const STATUS = ["new", "contacted", "quoted", "closed"] as const;

export default function EnquiriesPanel() {
  const d = useData<Enquiry[]>("enquiries");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => (d.data ?? []).filter((e) => (!status || e.status === status) && (!q || `${e.name} ${e.phone} ${e.product} ${e.location}`.toLowerCase().includes(q.toLowerCase()))), [d.data, q, status]);
  if (!d.data) return <Loading error={d.error} retry={d.reload} />;
  const cur = d.data.find((e) => e.id === open) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="serif mr-auto text-3xl">Enquiries <span className="text-base text-muted">({rows.length})</span></h2>
        <label className="sr-only" htmlFor="eq">Search enquiries</label>
        <input id="eq" type="search" className="input max-w-[14rem]" placeholder="Name, phone, product" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="es">Status</label>
        <select id="es" className="input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="mt-6">
        {rows.length === 0 ? <Empty>No enquiries.</Empty> : (
          <Table caption="Enquiries" head={["From", "Interest", "Qty", "Status", "Follow-up", ""]}>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-3">{e.name}<br /><span className="text-xs text-muted">{e.phone} · {dateLabel(e.createdAt)}</span></td>
                <td className="px-3">{e.product || "—"}<br /><span className="text-xs text-muted">{e.location}</span></td>
                <td className="px-3">{e.quantity}</td>
                <td className="px-3"><Pill tone={e.status === "new" ? "warn" : e.status === "closed" ? "neutral" : "ok"}>{e.status}</Pill></td>
                <td className="px-3 text-xs">{e.followUpAt ? <span className={e.followUpAt <= today && e.status !== "closed" ? "text-accent-text" : ""}>{e.followUpAt}{e.followUpAt <= today && e.status !== "closed" ? " · due" : ""}</span> : "—"}</td>
                <td className="px-3"><button className="btn btn-ghost !min-h-10 !px-3" onClick={() => setOpen(e.id)}>Open</button></td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      {cur && <EnquiryModal e={cur} onClose={() => setOpen(null)} onSaved={d.reload} />}
    </div>
  );
}

function EnquiryModal({ e, onClose, onSaved }: { e: Enquiry; onClose: () => void; onSaved: () => void }) {
  const say = useToast();
  const [status, setStatus] = useState(e.status);
  const [notes, setNotes] = useState(e.internalNotes ?? "");
  const [follow, setFollow] = useState(e.followUpAt ?? "");
  const [busy, setBusy] = useState(false);
  const sizes = SIZES.filter((s) => e.sizes[s]).map((s) => `${s}: ${e.sizes[s]}`).join(", ");
  const save = async () => {
    setBusy(true);
    try { await api("enquiries", "PATCH", { id: e.id, status, internalNotes: notes, followUpAt: follow }); say("Saved"); onSaved(); }
    catch (x) { say(x instanceof Error ? x.message : "Failed", "error"); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title={`Enquiry from ${e.name}`} wide>
      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-2 text-sm">
          <p>{e.phone}{e.email ? ` · ${e.email}` : ""}</p>
          <p><strong>{e.quantity}</strong> × {e.product || "unspecified"} → {e.location}</p>
          {sizes && <p>Sizes — {sizes}</p>}
          {e.notes && <p className="whitespace-pre-line border-l-2 border-line pl-3">{e.notes}</p>}
          {(e.attachmentKey || e.referenceImage) && (
            <p><a className="link-underline" target="_blank" rel="noopener noreferrer" href={e.attachmentKey ? `/api/admin/enquiries/${encodeURIComponent(e.id)}/attachment` : e.referenceImage}>View reference image</a> <span className="text-muted">(for discussion only)</span></p>
          )}
        </section>
        <section className="space-y-4">
          <Field label="Status"><select className="input" value={status} onChange={(x) => setStatus(x.target.value as Enquiry["status"])}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Follow-up date"><input type="date" className="input" value={follow} onChange={(x) => setFollow(x.target.value)} /></Field>
          <Field label="Internal notes"><textarea className="input" rows={4} maxLength={2000} value={notes} onChange={(x) => setNotes(x.target.value)} /></Field>
          <div className="flex gap-3"><button className="btn btn-solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            {e.phone && <a className="btn btn-ghost" href={`tel:${e.phone.replace(/[^\d+]/g, "")}`}>Call</a>}</div>
        </section>
      </div>
    </Modal>
  );
}
