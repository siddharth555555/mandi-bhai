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
- `cart/` — retailer's cart, items reference a `WholesalerListing` directly (not just a product), validated against live MOQ/stock.
- `orders/` — checkout fans a cart out into **one `Order` per distinct wholesaler** (never one order per cart), because each wholesaler packs and hands off independently. Checkout row-locks (`pessimistic_write`, sorted by id to avoid deadlocks) each listing and decrements stock inside the same transaction that creates the order.
- `delivery/` — platform-owned, not wholesaler-fulfilled: a Mandi Admin assigns a seeded `DeliveryPartnerProfile` (rider) to a packed order; rider marks picked-up/delivered/failed. One `Delivery` row per `Order`, kept as its own table because delivery has a different owner and lifecycle clock than the order.
- `wallet/` — Udhaar (credit) account + ledger (`UdhaarTransaction`, not just a balance, for auditability) plus `Payment` (kept separate from `Order` so an online gateway can slot in later without a schema change). Credit-limit is checked at checkout but the `draw` ledger entry posts at actual delivery time, not at order placement.
- `notifications/` — stubbed driver (`ConsoleNotificationDriver`), logs instead of sending real SMS/push.

Cross-cutting pattern worth knowing before adding new modules: **snapshot at the trust boundary**. `OrderItem` snapshots product name/pack/price, `Order.deliveryAddress` snapshots the retailer's address — both so history reads correctly even if the live source (listing, profile) changes later. Stock is released (incremented back) on any path where an order ends without reaching `delivered`: wholesaler reject, retailer cancel, delivery failure.

Mandi Admin accounts and riders are manual/seeded only (`backend/src/seed/seed.ts`) — no self-signup flow exists yet for either role.

### Frontend: single Expo app, routes by profile role

`App.tsx` is the auth-aware root navigator — it reads the active profile from `AuthContext` and routes to a per-role navigator/screen: `RetailerNavigator`, `WholesalerNavigator`, `MandiAdminHomeScreen`, or `RiderHomeScreen`. There is no separate admin console or rider app; both are screens inside this same RN app (a deliberate scope decision recorded in the PLAN docs, to avoid blocking feature work on separate app-shell builds).

- `src/api/client.ts` — single typed fetch wrapper for every backend endpoint; this is the contract to keep in sync when backend routes change.
- `src/auth/AuthContext.tsx` — token + session persistence via AsyncStorage.
- `src/navigation/` — route param types + per-role navigators.
- `src/screens/retailer/`, `src/screens/wholesaler/` — per-role screen sets; a few shared/entry screens (`PhoneScreen`, `OtpScreen`, `CreateProfileScreen`) live flat under `src/screens/`.
