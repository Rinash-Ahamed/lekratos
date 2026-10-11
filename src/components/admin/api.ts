let csrf: string | null = null;

async function token(force = false): Promise<string> {
  if (csrf && !force) return csrf;
  const r = await fetch("/api/admin/session", { cache: "no-store" });
  if (r.status === 401) { window.location.href = "/admin/login"; throw new Error("Session expired"); }
  csrf = ((await r.json()) as { csrf: string }).csrf;
  return csrf;
}

async function send(path: string, init: RequestInit, retry = true): Promise<Response> {
  const unsafe = init.method && init.method !== "GET";
  const headers = new Headers(init.headers);
  if (unsafe) headers.set("x-csrf-token", await token());
  const r = await fetch(`/api/admin/${path}`, { ...init, headers, cache: "no-store" });
  if (r.status === 401) { window.location.href = "/admin/login"; throw new Error("Session expired"); }
  if (r.status === 403 && unsafe && retry) { await token(true); return send(path, init, false); } // stale CSRF token → refresh once
  return r;
}

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await send(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "Request failed");
  return j as T;
}

export async function uploadImages(files: FileList | File[]): Promise<string[]> {
  const f = new FormData();
  Array.from(files).forEach((x) => f.append("files", x));
  const r = await send("upload", { method: "POST", body: f });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Upload failed");
  return j.urls as string[];
}

export async function logout() {
  await send("logout", { method: "POST" }).catch(() => undefined);
  window.location.href = "/admin/login";
}
