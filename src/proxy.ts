import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, parseSessionToken } from "@/lib/admin-session";

/**
 * 1) Admin gate (first line of defence; every admin handler re-verifies against the session store)
 * 2) Per-request CSP nonce + security headers for every page
 */
function csp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://storage.googleapis.com https://*.razorpay.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.razorpay.com https://lumberjack.razorpay.com" + (dev ? " ws: wss:" : ""),
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";

  if (isAdminPage || isAdminApi) {
    const ok = await parseSessionToken(req.cookies.get(ADMIN_COOKIE)?.value, process.env.ADMIN_SESSION_SECRET);
    if (!ok) {
      return isAdminApi
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set(process.env.CSP_MODE === "report-only" ? "content-security-policy-report-only" : "content-security-policy", policy);
  if (isAdminPage || isAdminApi) res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|txt|xml|webmanifest)$).*)" }],
};
