# le.kratos — T-shirt storefront

Next.js 16 · React 19 · TypeScript 6 · Tailwind 4 · Firebase (Firestore + Storage) · Razorpay

Finished T-shirts with the owner's artwork and photography. There is **no customer customizer**; an enquiry's reference image is for discussion only.

## Run locally

```bash
npm install
cp .env.example .env.local        # development works with the defaults (JSON store in ./.data)
ADMIN_PASSWORD='choose-a-long-passphrase' ADMIN_SESSION_SECRET="$(openssl rand -base64 48)" npm run dev
```

Store: http://localhost:3000 · Admin: http://localhost:3000/admin/login. Without Razorpay keys, checkout shows "online payments aren't available yet".
The bundled **Sample Tee NN** products are clearly-labelled placeholders — delete them in Admin → Products.

## Brand & design

- Official wordmark in `public/brand/` (`logo.png` = trimmed original, `logo-a.png` / `logo-b.png` = the two colour layers used by `<BrandMark>`).
- Single palette — **Brick × Beige** (`src/lib/theme.ts`): Brick Brown #843A26, Warm Beige #E8D5C0, Ivory #F8F4EE, Taupe #B6A79A, Espresso #2D211D, Olive Green #6B6F5A, Sand #C9B8A3, Charcoal #1A1A1A. WCAG contrast is enforced by `tests/unit/theme.test.ts`.
- Playfair Display (headings) + Inter (UI), self-hosted via Fontsource. Motion is CSS only (transform/opacity) and honours `prefers-reduced-motion`.

## Architecture in one page

- **Data layer** `src/lib/data/*` — one `Db` interface (get/list/set/create/delete/tx) with Firestore and JSON adapters; `src/lib/db.ts` is the repository layer.
- **Orders** `src/lib/orders.ts` — stock is reserved in a transaction when payment starts; the order id is derived from the checkout idempotency key; `markPaid` is idempotent (duplicate payments are auto-refunded; payments after expiry re-reserve stock or go to `review`); refunds are idempotent per refund id.
- **Payments** `src/lib/razorpay.ts` + `/api/razorpay/{order,verify,webhook}` — prices are always computed on the server; the browser's payment result is never trusted: HMAC signature **and** a gateway fetch (order id, amount, currency, captured) are required; the webhook is HMAC-verified over the raw body and de-duplicated.
- **Admin** — scrypt password → server-side session + signed cookie + CSRF header + same-origin check on every unsafe request; `requireAdmin()` is in every handler (checked by a unit test); persistent rate limits; audit log.
- **Uploads** — decoded and re-encoded to WebP with sharp (EXIF stripped, size/pixel limits); customer attachments are private.
- **Headers** — per-request CSP nonce in `src/proxy.ts`, HSTS, nosniff, frame denial, strict referrer policy.

## Scripts

| | |
|---|---|
| `npm run check` | typecheck + lint + unit tests |
| `npm test` | Vitest (db contract, orders, payment routes, admin security, theme) |
| `npm run build && npm run test:e2e` | Playwright against the production build (fake local gateway) |
| `npm run admin:hash` | create `ADMIN_PASSWORD_HASH` |
| `npm run migrate` | dry-run copy of the v1 JSON data to Firestore (`-- --apply` to write; create-if-absent, never deletes) |
| `npm run audit:prod` | `npm audit --omit=dev` |

## Deploying

See `docs/DEPLOYMENT.md` (environment, Firebase rules/indexes/TTL, Razorpay webhook, cron, go-live checklist).
Test status and honest limitations: `docs/AUDIT.md`.
