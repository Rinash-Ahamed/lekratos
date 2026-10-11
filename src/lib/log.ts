import "server-only";

/**
 * Structured server logging with redaction. Never pass request bodies, payment
 * credentials or customer contact details here – only ids and error codes.
 */
const REDACT = /(secret|password|token|signature|authorization|cookie|key|phone|email|address)/i;

function safe(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = REDACT.test(k) ? "[redacted]" : typeof v === "string" ? v.slice(0, 200) : v;
  }
  return out;
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ level: "info", msg, ...safe(meta) })),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(JSON.stringify({ level: "warn", msg, ...safe(meta) })),
  error: (msg: string, err?: unknown, meta?: Record<string, unknown>) =>
    console.error(
      JSON.stringify({
        level: "error",
        msg,
        err: err instanceof Error ? { name: err.name, message: err.message.slice(0, 300) } : undefined,
        ...safe(meta),
      }),
    ),
};
