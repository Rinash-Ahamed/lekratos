"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "../Modal";
import { api } from "./api";

/* ---------- toast ---------- */
const ToastCtx = createContext<(m: string, kind?: "ok" | "error") => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ m: string; kind: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const say = useCallback((m: string, kind: "ok" | "error" = "ok") => {
    setT({ m, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={say}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
        {t && <p className={`fade-in pointer-events-auto max-w-md px-5 py-3 text-sm shadow-xl ${t.kind === "error" ? "bg-accent text-accent-fg" : "bg-primary text-primary-fg"}`}>{t.m}</p>}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- confirm dialog ---------- */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; confirm: string; resolve: (v: boolean) => void } | null>(null);
  const ask = useCallback((title: string, body: string, confirm = "Confirm") => new Promise<boolean>((resolve) => setState({ title, body, confirm, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  const dialog = (
    <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ""}>
      <p className="text-muted">{state?.body}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={() => close(false)}>Cancel</button>
        <button className="btn btn-solid" onClick={() => close(true)}>{state?.confirm}</button>
      </div>
    </Modal>
  );
  return { ask, dialog };
}

/* ---------- data loading ---------- */
export function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let off = false;
    api<T>(path).then((d) => { if (!off) { setData(d); setError(""); } }, (e) => { if (!off) setError(e instanceof Error ? e.message : "Couldn't load"); });
    return () => { off = true; };
  }, [path, tick]);
  return { data, setData, error, loading: data === null && !error, reload };
}

export function Loading({ error, retry }: { error?: string; retry?: () => void }) {
  return error ? (
    <div role="alert" className="border hairline p-6"><p className="text-accent-text">{error}</p>{retry && <button className="btn btn-ghost mt-4" onClick={retry}>Retry</button>}</div>
  ) : (
    <div aria-busy="true" aria-label="Loading" className="space-y-3"><div className="skeleton h-10" /><div className="skeleton h-40" /></div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="border border-dashed border-line p-8 text-center text-muted">{children}</p>;

export function Field({ label, children, wide, hint }: { label: string; children: ReactNode; wide?: boolean; hint?: string }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="eyebrow mb-1 block text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const Pill = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "ok" | "warn" | "neutral" }) => (
  <span className={`eyebrow inline-block px-2 py-1 ${tone === "ok" ? "bg-accent text-accent-fg" : tone === "warn" ? "border border-accent-text text-accent-text" : "bg-sunk"}`}>{children}</span>
);

export function Table({ head, children, caption }: { head: string[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto border hairline">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sunk"><tr>{head.map((h) => <th key={h} scope="col" className="eyebrow px-3 py-3 text-muted">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
