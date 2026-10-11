"use client";

import type { AuditLog } from "@/lib/types";
import { dateTimeLabel } from "@/lib/format";
import { Empty, Loading, Table, useData } from "./ui";

export default function AuditPanel() {
  const d = useData<AuditLog[]>("audit");
  if (!d.data) return <Loading error={d.error} retry={d.reload} />;
  return (
    <div>
      <h2 className="serif text-3xl">Activity log</h2>
      <p className="mt-1 text-sm text-muted">The most recent admin and system actions. Passwords and payment details are never recorded.</p>
      <div className="mt-6">{d.data.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
        <Table caption="Audit log" head={["When", "Who", "Action", "Target"]}>
          {d.data.map((a) => <tr key={a.id}><td className="px-3 py-2 text-xs text-muted">{dateTimeLabel(a.at)}</td><td className="px-3">{a.actor}</td><td className="px-3 font-mono text-xs">{a.action}</td><td className="px-3 text-xs">{a.target ?? ""}</td></tr>)}
        </Table>
      )}</div>
    </div>
  );
}
