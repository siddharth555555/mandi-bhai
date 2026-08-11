# TODO / Deferred Decisions

Every stub, mock, or "decide later" item across the project is tracked here so
nothing gets forgotten. Update this file whenever a new shortcut is taken.

## Auth / Users
- [ ] **SMS OTP delivery is stubbed.** `backend/src/auth/otp.service.ts` generates
      and stores an OTP but does not send an SMS — it's returned directly in the
      `/auth/otp/request` response (dev-only) and logged to the console. Swap in
      a real provider (MSG91 / Gupshup / Twilio) before anything but local dev.
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
- [ ] Stock is a plain integer with no reservation concept. Once ordering
      exists, two retailers can both "buy" the last unit.
- [ ] MOQ is captured and displayed but nothing enforces it yet (enforcement
      belongs to the cart).
- [ ] Wholesalers can list products without being KYC-verified. If listing
      should be gated on verification, wire that in during Phase 4.

## Database
- [ ] `synchronize: true` in `backend/src/app.module.ts` auto-creates tables from
      entities for dev speed. **Must switch to TypeORM migrations before this
      touches real/shared data** — synchronize can silently drop/alter columns.

## Payments / KYC / Delivery (not started)
- [ ] Payment gateway integration (Razorpay/Cashfree) — not started.
- [ ] KYC document verification (Digilocker/Signzy/Karza) — not started, KYC
      screens will initially just store submitted data + doc uploads as "pending".
- [ ] Delivery/logistics integration — platform-owned per product decision, not
      designed yet.
- [ ] Udhaar credit limit logic — starts as a fixed manually-set limit; the
      order-history-based recommendation engine is explicitly deferred.

## Infra
- [ ] No CI/CD, no staging environment yet.
- [ ] File/document storage (KYC docs, product images) not wired up — no S3/R2
      bucket configured yet.
