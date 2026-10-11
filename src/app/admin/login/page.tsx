"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";

export default function AdminLogin() {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <form
        className="w-full max-w-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          let r: Response;
          try { r = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password: new FormData(e.currentTarget).get("password") }),
          }); } catch { setErr("Network error — try again"); setBusy(false); return; }
          if (r.ok) router.replace("/admin");
          else setErr((await r.json().catch(() => ({}))).error ?? "Couldn't sign in");
          setBusy(false);
        }}
      >
        <BrandMark className="h-10" />
        <h1 className="serif mt-6 text-3xl">Admin sign in</h1>
        <label htmlFor="pw" className="eyebrow mb-2 mt-10 block text-muted">Password</label>
        <input id="pw" name="password" type="password" required autoFocus autoComplete="current-password" className="input" />
        <p role="alert" className="mt-3 min-h-6 text-sm text-accent-text">{err}</p>
        <button className="btn btn-solid mt-4 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
