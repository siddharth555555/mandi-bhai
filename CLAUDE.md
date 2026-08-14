# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mandi Bhai — a B2B wholesale marketplace connecting retailers (kirana stores) with wholesalers through mandi (market)-scoped admins and platform-owned delivery riders. Monorepo: NestJS backend + Expo/React Native frontend + Postgres.

Read `TODO.md` first — every stub, mock, or deferred decision in the codebase is tracked there. Read `PLAN-order-delivery.md` and `PLAN-products-kyc.md` for the design rationale behind the two most recently built modules (they document *why*, not just *what*).

## Commands

### Postgres (from repo root)
```bash
cp .env.example .env
docker compose up -d postgres          # Postgres on localhost:5432
docker compose --profile tools up -d   # + pgAdmin on localhost:5050
```

### Backend (`backend/`)
```bash
cp .env.example .env
npm install
npm run start:dev       # watch mode, port 3000
npm run seed             # seeds mandis, admins, riders, catalogue (src/seed/seed.ts) — rerun after edits
npm run lint
npm run format
npm run build

npm test                          # all unit tests (jest, *.spec.ts colocated with source)
npx jest path/to/file.spec.ts     # single test file
npm run test:e2e                  # test/*.e2e-spec.ts
```

### Frontend (`frontend/`)
```bash
cp .env.example .env
npm install
npx expo start      # press w for web, or scan QR with Expo Go
```
If testing on a physical device, set `EXPO_PUBLIC_API_URL` in `frontend/.env` to your machine's LAN IP, not `localhost`.

**Expo has changed recently** — `frontend/AGENTS.md` (loaded automatically via `frontend/CLAUDE.md`) directs to read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo code; don't rely on older training data for Expo/RN APIs here.

## Architecture

### Backend: entities are hoisted, modules own their domain

`app.module.ts` is the single place that imports every TypeORM entity and every feature module — it's the fastest way to see the whole data model at a glance. `backend/src/entities/` holds only `User` and one profile entity per role (`RetailerProfile`, `WholesalerProfile`, `MandiAdminProfile`, `DeliveryPartnerProfile`); every other entity lives inside its owning feature module (e.g. `catalog/product.entity.ts`, `orders/order.entity.ts`).

`synchronize: true` is on for dev convenience — schema auto-syncs from entities on boot. Must switch to migrations before this touches real data (flagged in `TODO.md`).

Feature modules, in dependency order:
- `mandis/` — Mandi entity, `GET /mandis`. The scoping unit for wholesalers, admins and riders.
- `auth/` — phone+OTP login (OTP is dev-stubbed, returned directly in the response — see `otp.service.ts`), JWT issuance, profile creation. `guards/roles.decorator.ts` + `roles.guard.ts` implement `@Roles('retailer' | 'wholesaler' | 'mandi_admin' | 'delivery_partner')` route protection; `jwt-auth.guard.ts` + `strategies/jwt.strategy.ts` handle token verification.
- `catalog/` — master `Product` (global, not mandi-scoped) + `ProductAlias` for multilingual/fuzzy search + `Category`.
- `listings/` — `WholesalerListing`: one wholesaler's price/stock/MOQ offer against a master product. All pricing lives here, never on `Product` — the same product can be listed by many wholesalers at different prices.
- `cart/` — retailer's cart references a master `Product`, not a wholesaler's listing (the retailer buys from the platform, never a chosen supplier). Prices live through `PricingService`; `CartItem` snapshots `{price, moq}` at add-time and `POST /cart/validate` re-syncs the snapshot and issues a short-lived `confirmedPriceToken` (`cart-price-token.service.ts`, stateless HMAC — no table) that checkout re-verifies.
- `orders/` — checkout creates **one customer `Order`** per checkout (never a fan-out) — no wholesaler is chosen at this point. Checkout re-validates price/MOQ live a second time (independent of the token) before creating the order, matching PRD §9.2's two-point re-validation. Sourcing a wholesaler against a `PurchaseOrder` is not built yet — that's the allocation engine, a later plan.
- `delivery/` — platform-owned, not wholesaler-fulfilled: a Mandi Admin assigns a seeded `DeliveryPartnerProfile` (rider); rider marks picked-up/delivered/failed. One `Delivery` row per `Order`, kept as its own table because delivery has a different owner and lifecycle clock than the order. **Nothing currently creates a `Delivery` row** — the old trigger (a wholesaler marking an order "packed") was removed along with the per-wholesaler order model; its replacement (PO pickup → delivery) lands with the allocation engine.
- `wallet/` — holds `Payment` (kept separate from `Order` so a gateway can slot in without a schema change) and `payment-gateway.driver.ts` (`StubGatewayDriver`, same stub-now-swap-later pattern as `NotificationService`). Udhaar (`UdhaarAccount`/`UdhaarTransaction`) is descoped from v1 — the entities stay registered so the table/ledger design survive, but nothing writes to them. `PaymentMethod` is `cod | prepaid`.
- `notifications/` — stubbed driver (`ConsoleNotificationDriver`), logs instead of sending real SMS/push.

Cross-cutting pattern worth knowing before adding new modules: **snapshot at the trust boundary**. `OrderItem` snapshots product name/pack/price, `Order.deliveryAddress` snapshots the retailer's address — both so history reads correctly even if the live source (listing, profile) changes later. Stock reservation/release against a specific wholesaler does not happen at checkout anymore — no wholesaler is chosen until the (not-yet-built) allocation engine runs. This line will be re-added once that exists.

Mandi Admin accounts and riders are manual/seeded only (`backend/src/seed/seed.ts`) — no self-signup flow exists yet for either role.

### Frontend: single Expo app, routes by profile role

`App.tsx` is the auth-aware root navigator — it reads the active profile from `AuthContext` and routes to a per-role navigator/screen: `RetailerNavigator`, `WholesalerNavigator`, `MandiAdminHomeScreen`, or `RiderHomeScreen`. There is no separate admin console or rider app; both are screens inside this same RN app (a deliberate scope decision recorded in the PLAN docs, to avoid blocking feature work on separate app-shell builds).

- `src/api/client.ts` — single typed fetch wrapper for every backend endpoint; this is the contract to keep in sync when backend routes change.
- `src/auth/AuthContext.tsx` — token + session persistence via AsyncStorage.
- `src/navigation/` — route param types + per-role navigators.
- `src/screens/retailer/`, `src/screens/wholesaler/` — per-role screen sets; a few shared/entry screens (`PhoneScreen`, `OtpScreen`, `CreateProfileScreen`) live flat under `src/screens/`.
