"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BrandMark } from "../BrandMark";
import { logout } from "./api";
import { Loading, ToastHost } from "./ui";

const panel = (loader: () => Promise<{ default: React.ComponentType }>) => dynamic(loader, { loading: () => <Loading /> });
const Overview = panel(() => import("./OverviewPanel"));
const Products = panel(() => import("./ProductsPanel"));
const Orders = panel(() => import("./OrdersPanel"));
const Enquiries = panel(() => import("./EnquiriesPanel"));
const Content = panel(() => import("./ContentPanel"));
const Settings = panel(() => import("./SettingsPanel"));
const Audit = panel(() => import("./AuditPanel"));

const TABS = [
  ["Overview", Overview], ["Products", Products], ["Orders", Orders], ["Enquiries", Enquiries],
  ["Content", Content], ["Settings", Settings], ["Activity", Audit],
] as const;

export function AdminDashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("Overview");
  const Active = TABS.find(([n]) => n === tab)![1];
  return (
    <ToastHost>
      <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-5 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b hairline pb-4">
          <div className="flex items-center gap-4"><BrandMark className="h-7" /><span className="eyebrow text-muted">Admin</span></div>
          <div className="flex items-center gap-4">
            <a href="/" target="_blank" rel="noopener" className="eyebrow link-underline py-2">View store ↗</a>
            <button className="eyebrow link-underline py-2" onClick={() => void logout()}>Sign out</button>
          </div>
        </header>
        <nav aria-label="Admin sections" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {TABS.map(([n]) => (
            <button key={n} aria-current={tab === n ? "page" : undefined} onClick={() => setTab(n)} className={`min-h-11 shrink-0 border px-4 text-sm ${tab === n ? "border-primary bg-primary text-primary-fg" : "hairline"}`}>{n}</button>
          ))}
        </nav>
        <main className="mt-8" id="admin-main"><Active /></main>
      </div>
    </ToastHost>
  );
}
