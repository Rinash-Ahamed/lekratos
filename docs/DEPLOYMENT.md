# Deployment checklist

## 1. Firebase

1. Create a project; enable Firestore (native mode) and Storage.
2. Deploy `firestore:rules`, `firestore:indexes`, and `storage`. Rules deny client access; only the server Admin SDK reads or writes.
3. Add TTL policies on `rateLimits.expiresAt` and `adminSessions.expiresAt`.
4. Create a service account with Firestore and Storage access and configure the `FIREBASE_*` variables.
5. Optional v1 migration: run `npm run migrate` as a dry run, then `npm run migrate -- --apply`.

## 2. Manual UPI payment

1. In Admin → Settings → UPI payment, enter the receiving UPI ID and payee name, then upload the live QR code.
2. Make a small real payment and confirm that its reference and optional screenshot appear in Admin → Orders.
3. Verify that an order stays unconfirmed until an administrator checks the receiving account and selects **Verify payment**.
4. Test rejection, reservation expiry, duplicate references, and the stock-unavailable manual-review path before launch.

## 3. Admin and housekeeping

- Generate `ADMIN_PASSWORD_HASH` with `npm run admin:hash`; use an `ADMIN_SESSION_SECRET` of at least 32 random characters.
- Set `CRON_SECRET` and schedule `GET /api/cron/sweep` approximately every five minutes so abandoned checkouts release stock.
- Limit access to payment screenshots to trusted administrators and define a retention policy.

## 4. Go live

- Clear every required item in Admin → Overview.
- Complete business, contact, shipping, UPI, policy, size chart, and brand-story settings.
- Remove sample products and publish real products with accurate imagery and stock.
- Set `NEXT_PUBLIC_SITE_URL` and submit `/sitemap.xml` to Search Console.
