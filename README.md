# Mandi Bhai — Project Setup

Base scaffold (Postgres, backend, mobile frontend) plus the first real feature
module: **Users & Auth** (phone + OTP login, retailer/wholesaler profiles,
mandi-scoped admin). See `TODO.md` for every stub/deferred decision.

## Stack

- **Backend:** NestJS + TypeORM + PostgreSQL, JWT auth (passport-jwt)
- **Frontend:** React Native (Expo, TypeScript) + React Navigation
- **Database:** PostgreSQL 16, via Docker Compose

## Project structure

```
mandi-bhai/
├── TODO.md                 # every stubbed/deferred item — read this first
├── docker-compose.yml       # Postgres (+ optional pgAdmin) for local dev
├── .env.example             # DB credentials used by docker-compose.yml
├── backend/                  # NestJS API
│   ├── src/
│   │   ├── app.module.ts     # ConfigModule + TypeORM + Health/Auth/Mandis modules
│   │   ├── entities/         # User, RetailerProfile, WholesalerProfile, MandiAdminProfile
│   │   ├── mandis/            # Mandi entity + GET /mandis
│   │   ├── auth/               # OTP, JWT issuance, profile creation, guards
│   │   ├── seed/                # manual seed script (mandis + Mandi Admins)
│   │   └── health/              # GET /health — checks DB connectivity
│   └── .env.example
└── frontend/                  # Expo React Native app
    ├── App.tsx                 # Auth-aware navigator (Phone/OTP -> CreateProfile -> Home)
    └── src/
        ├── api/client.ts        # typed fetch wrapper for every backend endpoint
        ├── auth/AuthContext.tsx # token persistence (AsyncStorage) + session state
        ├── navigation/           # route param types
        └── screens/               # Phone, Otp, CreateProfile, RetailerHome, WholesalerHome
```

## Prerequisites

- Node.js 18+ and npm
- Docker + Docker Compose
- (For running the mobile app on a device) the Expo Go app, or an Android/iOS simulator

## 1. Start Postgres

```bash
cp .env.example .env
docker compose up -d postgres
```

This starts Postgres on `localhost:5432` with the credentials in `.env`.
Optionally start pgAdmin too: `docker compose --profile tools up -d`.

## 2. Start the backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

Verify it's talking to Postgres:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"mandi-bhai-backend","database":{"connected":true,...}}
```

`synchronize: true` is enabled in `app.module.ts` for dev convenience (auto-creates
tables from entities). **Switch to TypeORM migrations before this touches real data.**

### Seed mandis + a Mandi Admin

Mandi Admin accounts are manual/seeded only for now (no self-signup). After the
backend has started at least once:

```bash
npm run seed
```

Edit `src/seed/seed.ts` to add more mandis or admins, then rerun.

### Try the auth flow directly

```bash
# 1. Request an OTP (SMS is stubbed — devOtp is returned directly, see TODO.md)
curl -X POST http://localhost:3000/auth/otp/request \
  -H "Content-Type: application/json" -d '{"phone":"9876543210"}'

# 2. Verify it to get a JWT
curl -X POST http://localhost:3000/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"<devOtp from step 1>"}'

# 3. Create a retailer profile (use the token from step 2)
curl -X POST http://localhost:3000/auth/profiles/retailer \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"shopName":"Sharma Kirana Store"}'
```

## 3. Start the frontend

```bash
cd frontend
cp .env.example .env
npm install
npx expo start
```

- Press `w` for web, or scan the QR code with Expo Go on your phone.
- **If testing on a physical device**, edit `frontend/.env` and set
  `EXPO_PUBLIC_API_URL` to your machine's LAN IP (not `localhost`), e.g.
  `http://192.168.1.23:3000`.
- Flow: **Phone → OTP** (autofill button shown since SMS is stubbed) **→ Create
  Profile** (pick Retailer or Wholesaler, wholesaler also picks a mandi from
  the seeded list) **→ Home screen** for that role. Session persists across
  app restarts via AsyncStorage; "Sign out" on the home screen clears it.

## What's implemented vs. still ahead

**Done:** phone+OTP login, JWT issuance, retailer/wholesaler profile creation,
mandi listing, manually-seeded Mandi Admins, route guards ready for future
role-gated endpoints.

**Not yet:** catalog, cart/orders, wallet/Udhaar, KYC, payments, Mandi Admin
console UI, real SMS delivery. See `TODO.md` for the full list and `git log`
for what's shipped so far. Next logical module: **Catalog & SKU listing**
(wholesaler "list new SKU" + moderation queue), since orders/cart depend on it.
