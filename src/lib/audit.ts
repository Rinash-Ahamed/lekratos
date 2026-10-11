import "server-only";
import { db } from "./db";
import { log } from "./log";
import { newId } from "./ids";
import type { AdminCtx } from "./admin-auth";
import type { AuditLog } from "./types";

/** Append-only record of important admin actions. Store ids/status only – never customer PII or secrets. */
export async function audit(ctx: Pick<AdminCtx, "actor" | "ipHash"> | null, action: string, target?: string, meta?: AuditLog["meta"]) {
  try {
    await db.audit.add({
      id: newId("AUD", 12),
      at: new Date().toISOString(),
      actor: ctx?.actor ?? "system",
      action,
      target,
      meta,
      ipHash: ctx?.ipHash,
    });
  } catch (e) {
    log.error("audit write failed", e, { action });
  }
}
