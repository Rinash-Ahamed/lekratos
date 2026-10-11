# Audit & results (final)

## Baseline problems found and fixed
- Prices/stock trusted client input -> now server-side (pricing + transactional stock reservation).
- Payment verification incomplete -> token + HMAC + gateway fetch (order id, amount, currency, captured); webhook HMAC on raw body, event de-duplication, idempotent markPaid, auto-refund of duplicates.
- Admin auth weak -> scrypt, signed session + server-side session row, CSRF header + same-origin, persistent rate limits, audit log.
- Uploads -> sharp re-encode to WebP (EXIF stripped), private enquiry attachments, strict /uploads route.
- Uploaded images 404 under `next start`, fixed-position dialogs mispositioned by a transform animation (found by e2e, fixed).
- Dependencies: latest stable, 0 audit vulnerabilities, no install deprecation warnings.

## Independent security review (read-only agent)
No critical/high. Fixed: spoofable X-Forwarded-For (now platform header or Nth-from-right, `TRUST_PROXY_HOPS`), protocol-relative banner links.
Open (low): global login limit can be used to lock the admin out for an hour; a captured payment on a superseded gateway order is logged but not auto-refunded; admin-vs-webhook refund race can drop the restock flag; order token in status URL query; request bodies buffered before size check; CSP keeps `style-src 'unsafe-inline'`.

## Test results (executed)
- tsc, ESLint, 96 unit tests, production build: pass
- Playwright (Chromium, production build): 33/33 pass
- npm audit: 0 vulnerabilities

## Not verified
Real Razorpay sandbox payments (a fake gateway is used), Firestore adapter against Firestore/emulator, Firefox/WebKit, real-device mobile.
