# le.kratos — T-shirt storefront

Next.js 16 · React 19 · TypeScript 6 · Tailwind 4 · Firebase (Firestore + Storage) · Manual UPI verification

Finished T-shirts with the owner's artwork and photography. There is **no customer customizer**; an enquiry's reference image is for discussion only.

## Run locally

```bash
npm install
cp .env.example .env.local        # development works with the defaults (JSON store in ./.data)
ADMIN_PASSWORD='choose-a-long-passphrase' ADMIN_SESSION_SECRET="$(openssl rand -base64 48)" npm run dev
```

Store: http://localhost:3000 · Admin: http://localhost:3000/admin/login. Configure the receiving UPI ID, payee name and QR code in Admin → Settings before checkout can accept orders.
The bundled **Sample Tee NN** products are clearly-labelled placeholders — delete them in Admin → Products.

## Brand & design

- Official wordmark in `public/brand/` (`logo.png` = trimmed original, `logo-a.png` / `logo-b.png` = the two colour layers used by `<BrandMark>`).
- Single palette — **Brick × Beige** (`src/lib/theme.ts`): Brick Brown #843A26, Warm Beige #E8D5C0, Ivory #F8F4EE, Taupe #B6A79A, Espresso #2D211D, Olive Green #6B6F5A, Sand #C9B8A3, Charcoal #1A1A1A. WCAG contrast is enforced by `tests/unit/theme.test.ts`.
- Playfair Display (headings) + Inter (UI), self-hosted via Fontsource. The hero combines a lightweight WebGL fluid field with transform-based garment motion; reduced-motion preferences disable non-essential movement.

## Architecture in one page

- **Data layer** `src/lib/data/*` — one `Db` interface (get/list/set/create/delete/tx) with Firestore and JSON adapters; `src/lib/db.ts` is the repository layer.
- **Orders** `src/lib/orders.ts` — stock is reserved in a transaction when payment starts; the order id is derived from the checkout idempotency key; `markPaid` is idempotent (duplicate payments are auto-refunded; payments after expiry re-reserve stock or go to `review`); refunds are idempotent per refund id.
- **Payments** `/api/payment/{order,submit}` — prices are computed on the server, stock is reserved atomically, and customer-submitted UPI references are de-duplicated. A reference or screenshot never marks an order paid; an administrator must verify the receiving account.
- **Admin** — scrypt password → server-side session + signed cookie + CSRF header + same-origin check on every unsafe request; `requireAdmin()` is in every handler (checked by a unit test); persistent rate limits; audit log.
- **Uploads** — decoded and re-encoded to WebP with sharp (EXIF stripped, size/pixel limits); customer attachments are private.
- **Headers** — per-request CSP nonce in `src/proxy.ts`, HSTS, nosniff, frame denial, strict referrer policy.

## Scripts

| | |
|---|---|
| `npm run check` | typecheck + lint + unit tests |
| `npm test` | Vitest (db contract, orders, payment routes, admin security, theme) |
| `npm run build && npm run test:e2e` | Production build and Playwright browser checks |
| `npm run admin:hash` | create `ADMIN_PASSWORD_HASH` |
| `npm run migrate` | dry-run copy of the v1 JSON data to Firestore (`-- --apply` to write; create-if-absent, never deletes) |
| `npm run audit:prod` | `npm audit --omit=dev` |

## Deploying

See `docs/DEPLOYMENT.md` (environment, Firebase rules/indexes/TTL, UPI setup, cron, go-live checklist).
Test status and honest limitations: `docs/AUDIT.md`.
