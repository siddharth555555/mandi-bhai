# Mandi Bhai — API Reference

Reflects the backend as of Phase 0 / Plan A (cart & checkout foundation). This
is a living document — update it in the same commit as any endpoint change.
See `PRD.md` §15 for the full target API surface across every phase; this
file documents what actually exists **right now**, not the target.

Base URL: `http://localhost:3000` (or `EXPO_PUBLIC_API_URL` on device).
Auth: `Authorization: Bearer <jwt>` from `POST /auth/otp/verify`, except
where noted public.

## Auth (`auth/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/otp/request` | public | Dev-stubbed — OTP returned in the response (`devOtp`), also logged |
| POST | `/auth/otp/verify` | public | Returns JWT + every profile on the account |
| POST | `/auth/profile` | authenticated | Creates a role profile (retailer/wholesaler) for the current user |

## Mandis (`mandis/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/mandis` | public | List of seeded mandis |

## Catalogue (`catalog/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/categories` | public | |
| GET | `/products` | public | Paginated search; each row's `offer` is the anonymised platform price (`sellingPrice`, `mandiAverage`, `savingsVsAverage`, `moq`, `stockStatus`) — never a wholesaler name or raw quote |
| GET | `/products/:id` | public | Single product + its `offer` block |
| POST/PATCH `/admin/*` | super_admin | Master catalogue CRUD — see `admin-catalog.controller.ts` |

## Pricing (`pricing/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/super-admin/pricing/products/:id` | super_admin | Every quote, min/avg/spread, markup, selling price, margin — the one surface where cost/margin are visible (PRD §2.2) |
| PUT | `/super-admin/pricing/products/:id/markup` | super_admin | Set `percent` and optional `moqOverride` |

## Cart (`cart/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/cart` | retailer | Read-only. Diffs each line's stored snapshot against a fresh live price; `priceChanged`/`moqChanged`/`belowMoq`/`unavailable` flags per item, `canCheckout` overall. Never mutates. |
| POST | `/cart/items` | retailer | Body `{ productId, quantity }`. Prices via `PricingService`, snapshots the line |
| PATCH | `/cart/items/:id` | retailer | Body `{ quantity }`. Never re-prices |
| DELETE | `/cart/items/:id` | retailer | |
| POST | `/cart/validate` | retailer | Re-prices every line, **syncs** each snapshot to the live figures, and — only if every line is then clean — returns `confirmedPriceToken` (short-lived, ~10 min). Call this right before checkout |

## Checkout & Orders (`orders/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/checkout` | retailer | Body `{ paymentMethod: 'cod'\|'prepaid', confirmedPriceToken }`. Verifies the token against the cart's current snapshots, re-checks live pricing independently, then creates **one** `Order` + line items + one `Payment` and clears the cart. `prepaid` runs through the stubbed gateway (`StubGatewayDriver`, always succeeds in dev) |
| GET | `/orders` | retailer | My orders, optional `?status=` |
| GET | `/orders/:id` | retailer | |
| POST | `/orders/:id/cancel` | retailer | Allowed only while `status = placed`. **Interim behaviour** — there is no cutoff yet, so this is not yet gated on one (PRD D7 lands with cutoff batching) |

**Not yet built:** wholesaler-facing order/PO management (`wholesaler/orders*` was removed — it operated on the old per-wholesaler `Order` shape, which no longer exists; a `PurchaseOrder`-based replacement lands with the allocation engine).

## Delivery (`delivery/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/admin/deliveries/unassigned` | mandi_admin | |
| GET | `/admin/deliveries/partners` | mandi_admin | |
| POST | `/admin/deliveries/:id/assign` | mandi_admin | |
| GET | `/rider/deliveries` | delivery_partner | |
| POST | `/rider/deliveries/:id/picked-up` | delivery_partner | |
| POST | `/rider/deliveries/:id/delivered` | delivery_partner | Body `{ paymentCollected? }` — COD only; prepaid orders are already settled at checkout |
| POST | `/rider/deliveries/:id/failed` | delivery_partner | Body `{ reason }` |

**Known gap:** nothing currently creates a `Delivery` row — the old trigger (`wholesaler marks packed`) was removed along with the per-wholesaler order model, and its replacement (PO pickup → delivery) lands with the allocation engine. These endpoints are correct but presently unreachable in practice.

## Removed in this plan

- `GET /wallet/me`, `PATCH /admin/wallet/:id/limit`, `POST /admin/wallet/:id/repayment` — Udhaar descoped (PRD §9.4). `UdhaarAccount`/`UdhaarTransaction` tables are retained but unwritten.
- `wholesaler/orders*` (list/confirm/reject/pack) — operated on the old per-wholesaler `Order`; superseded by a `PurchaseOrder` surface in the next plan.
