# Implementation audit

## Payment and inventory controls

- Prices, discounts, shipping, and stock are calculated server-side.
- Checkout reserves variants in a database transaction and records a reservation deadline.
- Customer UPI references are normalised and claimed atomically to reduce duplicate submissions.
- Screenshots are sanitised, re-encoded, stored privately, and exposed only through an authenticated admin route.
- A submitted reference or screenshot always remains `verification_pending`; it never marks an order paid.
- Admin verification and any necessary stock re-allocation happen atomically. If stock is unavailable, the order moves to manual review rather than confirmation.
- Rejection releases reserved stock and records the actor, reason, timestamp, and audit event.
- The scheduled sweep releases abandoned holds. Submitted payments whose hold expires remain visible for manual verification.

## Security controls retained

- Server-side admin sessions, signed cookies, CSRF and same-origin enforcement, rate limits, and audit logs.
- Sharp image decoding/re-encoding with metadata removal and pixel/byte limits.
- Per-request CSP nonce, frame denial, HSTS, nosniff, and strict referrer policy.
- Firestore and JSON adapters share transactional order logic.

## Verification status

Build, lint, type-check, and automated tests have not been run for this redesign because the project owner explicitly requested that those checks wait for approval.

Before launch, manually exercise: successful verification, rejection, duplicate transaction references, an expired reservation, payment after expiry, stock unavailable during verification, screenshot access permissions, and mobile UPI deep links.
