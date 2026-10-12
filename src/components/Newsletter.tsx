"use client";

import { useState } from "react";

export function Newsletter() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <form
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const email = new FormData(e.currentTarget).get("email");
        setState("busy");
        try {
          const r = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
          setState(r.ok ? "done" : "error");
        } catch {
          setState("error");
        }
      }}
    >
      <label htmlFor="nl" className="sr-only">Email address</label>
      <input id="nl" name="email" type="email" required autoComplete="email" placeholder="you@email.com" className="input flex-1" />
      <button className="btn btn-solid tracking-wide" disabled={state === "busy" || state === "done"}>{state === "done" ? "You're in" : state === "busy" ? "Joining…" : "Join the list"}</button>
      <p role="status" className={`text-sm transition-all duration-300 ${state === "done" ? "text-accent-text font-medium" : state === "error" ? "text-accent-text" : "text-muted"} sm:sr-only`}>
        {state === "done" ? "Welcome to the circle — you're subscribed." : state === "error" ? "Something went wrong. Please try again." : ""}
      </p>
    </form>
  );
}
