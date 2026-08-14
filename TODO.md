# TODO / Deferred Decisions

Every stub, mock, or "decide later" item across the project is tracked here so
nothing gets forgotten. Update this file whenever a new shortcut is taken.

## Auth / Users
- [ ] **SMS OTP delivery is stubbed.** `backend/src/auth/otp.service.ts` generates
      and stores an OTP but does not send an SMS — it's returned directly in the
      `/auth/otp/request` response (dev-only) and logged to the console (see
      `TODO(sms)` comment in the service). Swap in a real provider (MSG91 / Gupshup
      / Twilio) before anything but local dev.
- [ ] **Mandi Admin accounts are manual/seeded only** — no self-signup or invite
      flow yet. New admins must be added via `backend/src/seed/seed.ts`. Revisit
      if/when self-serve admin onboarding is needed.
- [ ] JWT secret is a hardcoded dev default in `.env.example` — replace with a
      real secret (and rotate it) before any non-local deployment.
- [ ] No refresh-token flow — access tokens are long-lived for dev convenience.
      Add refresh tokens + shorter expiry before production.
- [ ] "Switch role" is currently just "pick a different existing profile" on the
      client — there's no backend concept of an "active role" session.

## Catalogue (products / aliases)
- [ ] **Search relevance is substring-only.** `q=haldi` correctly finds
      "Everest Turmeric Powder" (via the `haldi` alias) but also matches
      "Haldiram's Aloo Bhujia" because `hald` is a substring of the brand.
      Exact and prefix matches should rank above mid-word ones — plan is to
      add `pg_trgm` similarity scoring when the merge-suggestion feature
      lands (see PLAN-products-kyc.md §4).
- [ ] No product images yet. `Product.imagePath` exists but nothing populates
      it; the app still renders the generated Packshot component.
- [ ] Master products are global, so any mandi admin's edit affects every
      mandi. Intentional for now — see PLAN-products-kyc.md §1.
- [ ] No bulk SKU import (CSV/Excel) for wholesalers with large catalogues.
- [ ] Alias capture from unmatched retailer searches — deliberately not built.

## Listings / pricing
- [ ] Promotions, coupons, deal pricing and slab/tier pricing are **not**
      built — the listing carries a single flat price. This is the next module.
- [ ] No price history or audit trail: changing a listing's price overwrites
      the old value with no record of what it was.
- [x] ~~Stock is a plain integer with no reservation concept.~~ Checkout now
      row-locks each `WholesalerListing` (`pessimistic_write`, sorted by id to
      avoid deadlocks) and decrements stock inside the same transaction that
      creates the order — see the Orders module in PLAN-order-delivery.md.
      Stock is still released (incremented back) on reject/cancel/delivery-failed.
- [ ] MOQ is enforced at cart-validate and checkout (both re-check live MOQ), but there is still no automatic allocation engine — sourcing/MOQ-fit at batch time is unbuilt (see PLAN doc for the pivot, PRD §10).
- [ ] Wholesalers can list products without being KYC-verified. If listing
      should be gated on verification, wire that in during Phase 4.

## Database
- [ ] `synchronize: true` in `backend/src/app.module.ts` auto-creates tables from
      entities for dev speed. **Must switch to TypeORM migrations before this
      touches real/shared data** — synchronize can silently drop/alter columns.

## Orders / Checkout (pivot in progress — see `docs/superpowers/plans/2026-08-14-phase0-plan-a-cart-checkout-foundation.md`)
- [x] ~~Retailer picks a wholesaler per listing.~~ Checkout now creates one
      customer `Order`, no wholesaler chosen — sourcing is deferred entirely.
- [ ] **No allocation/sourcing engine yet.** Nothing assigns a wholesaler to
      a placed order. The next plan adds `PurchaseOrder`, the cheapest-
      in-stock-meeting-MOQ allocator, and re-source-on-shortfall.
- [ ] **No cutoff/batching yet.** `Order.cancelOrder` allows cancellation
      any time the order is `placed` — there is no cutoff to make that the
      commitment point (PRD D7). Do not treat this as final behaviour.
- [ ] **Wholesaler-side order management was removed**, not rebuilt.
      `wholesaler/orders*` operated on the old per-wholesaler `Order` shape;
      its replacement is a `PurchaseOrder` surface, not yet built.
- [ ] **Delivery creation has no trigger.** The old one (`wholesaler marks
      packed`) was removed with the wholesaler order flow. Nothing currently
      creates a `Delivery` row.
- [ ] Udhaar/wallet fully removed from checkout and delivery. `PaymentMethod`
      is `cod | prepaid`; prepaid runs through a stub gateway
      (`StubGatewayDriver`) that always succeeds in dev — no real gateway
      wired up.

## Orders / Delivery / Wallet (see PLAN-order-delivery.md)
- [ ] **Payment gateway is stubbed — COD and Udhaar (credit) only.** No online
      gateway (Razorpay/Cashfree) integration yet; `Payment` is its own entity
      (decoupled from `Order`) specifically so a gateway can be swapped in later
      without a schema change.
- [ ] **Order/delivery notifications are stubbed.**
      `backend/src/notifications/notification.service.ts` logs to the console
      (`ConsoleNotificationDriver`) instead of sending real SMS/push for order
      placed/confirmed/rejected/assigned/delivered events. Swap in a real
      provider (same one chosen for OTP) before production.
- [ ] Udhaar credit limit is still a fixed, manually-set-per-retailer value
      (`PATCH /admin/wallet/:retailerProfileId/limit`) — the order-history-based
      recommendation engine is explicitly deferred.
- [ ] No repayment collection flow for Udhaar — a Mandi Admin can post a
      `UdhaarTransaction` of type `repayment` (`POST
      /admin/wallet/:retailerProfileId/repayment`) but there's no
      retailer-facing "pay down my Udhaar" screen yet.
- [ ] No automatic retry/re-assignment after a failed delivery — a Mandi Admin
      re-assigns manually by assigning a fresh rider once a new attempt is warranted.
- [ ] No rider trip batching — every delivery is assigned and tracked
      independently, one order at a time.
- [ ] Delivery/retailer/wholesaler addresses are free text with no geocoding —
      no map view, no route optimization for riders.
- [ ] No partial delivery / partial return handling — an order is delivered or
      it fails, in full.
- [ ] **Delivery Partner (rider) accounts are manual/seeded only**, like Mandi
      Admins — no self-signup or invite flow yet. Add via `backend/src/seed/seed.ts`.

## KYC (not started)
- [ ] KYC document verification (Digilocker/Signzy/Karza) — not started, KYC
      screens will initially just store submitted data + doc uploads as "pending".

## Infra
- [ ] No CI/CD, no staging environment yet.
- [ ] File/document storage (KYC docs, product images) not wired up — no S3/R2
      bucket configured yet.
