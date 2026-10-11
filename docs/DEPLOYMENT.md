# Deployment checklist

## 1. Firebase
1. Create a project; enable **Firestore** (native mode) and **Storage**.
2. `firebase deploy --only firestore:rules,firestore:indexes,storage` — rules deny **all** client access; only the server (Admin SDK) reads/writes.
3. Add TTL policies on `rateLimits.expiresAt`, `webhookEvents.expiresAt`, `adminSessions.expiresAt` (Firestore → Time-to-live).
4. Create a service account (Firestore + Storage access) and set the `FIREBASE_*` variables from `.env.example`.
5. Optional migration of v1 data: `npm run migrate` (dry run) then `npm run migrate -- --apply`. It only creates missing documents.

## 2. Razorpay
1. Put live/test `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in the host secrets.
2. Webhook → `https://YOUR-SITE/api/razorpay/webhook`, events `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`; copy its secret to `RAZORPAY_WEBHOOK_SECRET`.
3. **Run a real sandbox payment end-to-end before launch** (the automated tests use a local fake of the Razorpay API, not Razorpay itself).

## 3. Admin & housekeeping
- `npm run admin:hash` → `ADMIN_PASSWORD_HASH`; `ADMIN_SESSION_SECRET` ≥ 32 random chars.
- Schedule `GET /api/cron/sweep` every ~5 minutes with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron) so abandoned checkouts release stock.

## 4. Go-live
- Open Admin → Overview and clear every **required** item on the launch checklist.
- Fill Settings (business name, contact, shipping, returns/privacy/terms, size chart, brand story) and tick “policies reviewed” only after a legal review.
- Delete the Sample products; upload real photography.
- Set `NEXT_PUBLIC_SITE_URL`; submit `/sitemap.xml` to Search Console.
