# Implementation Plan — Cart, Orders & Delivery

Covers the next module after Products, Aliases & KYC (PLAN-products-kyc.md):
cart, checkout, order lifecycle, platform-owned delivery, and Udhaar
(credit)/COD settlement. KYC and SKU-submission moderation (Phases 3–4 of
the previous plan) remain unbuilt — this module deliberately jumps ahead of
them because ordering is the core loop the whole app exists for. Flagging
that gap explicitly in §7.

## Decisions taken

| Question | Decision |
|---|---|
| Delivery model | **Platform-owned** — Mandi Bhai assigns its own riders, not the wholesaler |
| Payment methods (v1) | **Udhaar (credit) and COD only** — no online gateway yet |
| Cart | **In scope** — Cart/CartItem don't exist yet; orders depend on them |
| Checkout unit | **One `Order` per wholesaler per checkout** — a cart spanning 3 wholesalers produces 3 orders, each with its own delivery |
| Stock handling | **Reserved at order placement**, released on reject/cancel/failed-delivery |
| Rider onboarding | **Manual/seeded only** (same pattern as Mandi Admins) — no self-signup yet |

---

## 1. Core modelling decision: Cart → per-wholesaler Orders → Delivery

The catalogue's PDP already shows the same product from several wholesalers
side by side, and nothing stops a retailer's cart from mixing sellers. But a
single "order" can only ever belong to one wholesaler — that's who packs it,
and that's where a rider picks it up from. So checkout is a **fan-out**:

- **`Cart` / `CartItem`** — one open cart per retailer, items reference a
  specific `WholesalerListing` (not just a Product — price/stock/MOQ are
  listing-level).
- **`Order` / `OrderItem`** — created at checkout, **one Order per distinct
  wholesaler** in the cart, each carrying only that wholesaler's items.
- **`Delivery`** — one per Order (not per checkout). Platform-owned: a
  Mandi Admin (or later, a dedicated ops role) assigns a rider to pick up
  from the wholesaler and drop at the retailer.

This mirrors the "sellers compete, platform delivers" shape already implied
by the marketplace design, and keeps each Order's status (confirmed, packed,
delivered) meaningful — a single retailer checkout naturally becomes several
independently-tracked shipments, which is also how the retailer will expect
to see "3 orders placed" rather than one order with mixed states.

**Open gap this surfaces:** neither `RetailerProfile` nor `WholesalerProfile`
currently store an address — there's nothing for a rider to navigate to.
This module adds a plain-text `address` field to both (structured
address/geo can come later; not blocking for v1 since mandis are
neighborhood-sized and riders currently rely on a phone call + text address
like most local delivery today).

---

## 2. Data model

### Cart — one open cart per retailer
```
id, retailerProfileId (unique, one open cart per retailer), updatedAt
```

### CartItem
```
id, cartId, wholesalerListingId, quantity,
createdAt, updatedAt
unique (cartId, wholesalerListingId)
```

Price is **not** copied onto the cart item — cart always reads the live
`WholesalerListing.pricePerUnit`/`stockUnits`/`moq` so the cart reflects
reality up to the moment of checkout. Quantity is validated against MOQ and
stock at both add-to-cart and checkout time (checkout is the authoritative
check, cart-time is just early feedback).

### Order
```
id, orderNumber (human-readable, e.g. MB-2026-000123),
retailerProfileId, wholesalerProfileId, mandiId,
status: placed | confirmed | rejected | packed | assigned |
        picked_up | delivered | cancelled | delivery_failed,
paymentMethod: cod | udhaar,
paymentStatus: pending | paid | failed,
subtotal, itemCount,
deliveryAddress (snapshot, not a live FK — so later address edits don't
                  rewrite history),
placedAt, confirmedAt?, packedAt?, deliveredAt?, cancelledAt?,
cancelReason?, rejectReason?, createdAt, updatedAt
```

`deliveryAddress` is a snapshot (copied from the retailer profile at
checkout time) for the same reason `pricePerUnit` isn't copied onto listings
elsewhere in the codebase's pattern would suggest — except here we *do* want
a frozen copy, because an order already in transit shouldn't silently
retarget if the retailer edits their profile address later.

### OrderItem
```
id, orderId, wholesalerListingId, productId (denormalised for history,
  since a listing could theoretically be removed later),
productNameSnapshot, packSizeSnapshot,
quantity, pricePerUnit, lineTotal
```

Snapshotting product name/pack/price onto the line item means an order
placed today still reads correctly even if the wholesaler later edits the
listing — standard "orders are immutable receipts" practice, and consistent
with `SkuSubmission` already snapshotting proposed values rather than
pointing live at a Product.

### DeliveryPartner (rider) — seeded, like Mandi Admin
```
id, name, phone (unique), mandiId, status: active | inactive, createdAt
```

Riders are mandi-scoped (they physically work a mandi's catchment) and
manually added via the seed script for now, same shortcut already taken for
Mandi Admins — no separate onboarding flow to build in this module.

### Delivery
```
id, orderId (unique — one delivery per order),
deliveryPartnerId?, mandiId,
status: unassigned | assigned | picked_up | delivered | failed,
assignedAt?, pickedUpAt?, deliveredAt?, failedAt?, failureReason?,
createdAt, updatedAt
```

Kept as its own table rather than fields on `Order` because delivery has a
different owner (Mandi Admin / rider) and a different lifecycle clock than
the order itself — an order can be "confirmed" for hours before a rider is
even assigned, and this keeps `Order.status` a small enum instead of merging
two state machines into one.

### UdhaarAccount + UdhaarTransaction
```
UdhaarAccount:
  id, retailerProfileId (unique), creditLimit, outstandingBalance,
  updatedAt
  -- creditLimit stays a fixed manually-set value per TODO.md; the
  -- order-history-based recommendation engine remains explicitly deferred

UdhaarTransaction:
  id, udhaarAccountId, orderId?, type: draw | repayment | adjustment,
  amount, balanceAfter, note?, createdAt
```

A ledger (not just a running balance) so "why is my outstanding ₹4,200"
is always answerable — same audit-trail reasoning already applied to
`SkuSubmission` and KYC review fields elsewhere in the codebase.

### Payment
```
id, orderId (unique), method: cod | udhaar, amount,
status: pending | collected | failed,
collectedAt?, collectedByDeliveryPartnerId? -- set when a rider marks COD collected
```

Kept as its own table (rather than two columns on Order) so a future
gateway-based method slots in without an Order schema change — same
swappable-driver instinct as `StorageService` in the previous module.

---

## 3. Endpoints

### Retailer cart & checkout (JWT + @Roles('retailer'))
```
GET    /cart                              my open cart, live prices/stock
POST   /cart/items                        { wholesalerListingId, quantity }
PATCH  /cart/items/:id                    { quantity }
DELETE /cart/items/:id
POST   /checkout                          { paymentMethod: cod|udhaar }
                                           -> validates MOQ/stock/credit limit,
                                              splits into N Orders, reserves stock,
                                              clears cart
GET    /orders                            my orders, newest first, filter by status
GET    /orders/:id                        order + items + delivery status
POST   /orders/:id/cancel                 only while status in placed|confirmed
```

### Wholesaler order management (JWT + @Roles('wholesaler'))
```
GET   /wholesaler/orders?status=          incoming orders for my listings
POST  /wholesaler/orders/:id/confirm
POST  /wholesaler/orders/:id/reject       { reason }  -> releases reserved stock
POST  /wholesaler/orders/:id/pack         -> ready for rider pickup
```

### Mandi Admin — delivery assignment (JWT + @Roles('mandi_admin'), own mandi)
```
GET   /admin/deliveries?status=unassigned          packed orders awaiting a rider
POST  /admin/deliveries/:orderId/assign            { deliveryPartnerId }
GET   /admin/delivery-partners                     riders in my mandi
POST  /admin/wallet/:retailerProfileId/limit       { creditLimit }  -- adjust Udhaar limit
```

### Rider (JWT + @Roles('delivery_partner'))
```
GET   /rider/deliveries                   assigned to me, newest first
POST  /rider/deliveries/:id/picked-up
POST  /rider/deliveries/:id/delivered     { paymentCollected?: boolean }  -- COD confirmation
POST  /rider/deliveries/:id/failed        { reason }
```

`delivered` is the one moment two state machines close together: it flips
`Delivery.status` to `delivered`, `Order.status` to `delivered`, and — for
COD — `Payment.status` to `collected`; for Udhaar it posts a `draw`
transaction to `UdhaarTransaction` for the order amount. This needs a DB
transaction wrapping all three writes.

### Retailer wallet
```
GET /wallet/me       creditLimit, outstandingBalance, available, recent transactions
```

---

## 4. Stock reservation & concurrency

TODO.md already flags this: *"Stock is a plain integer with no reservation
concept. Once ordering exists, two retailers can both 'buy' the last unit."*
This module is where that gets fixed:

- `POST /checkout` runs inside a DB transaction. For each `WholesalerListing`
  being ordered, it does a row-level lock (`SELECT ... FOR UPDATE`) on the
  listing, re-checks `stockUnits >= quantity` and `quantity >= moq`, then
  decrements `stockUnits` and creates the Order/OrderItem rows atomically.
- If any listing in the cart fails the check (someone else bought the stock
  first, or the wholesaler dropped the price/deactivated it), checkout fails
  for that wholesaler's slice with a clear error identifying which item —
  it does **not** silently drop the item or partially check out.
- Stock is released (incremented back) on wholesaler reject, retailer
  cancel, or delivery failure with no retry — anywhere an Order ends without
  becoming `delivered`.

---

## 5. Udhaar credit check

At checkout, if `paymentMethod: udhaar`:
1. Load the retailer's `UdhaarAccount` (create one lazily with `creditLimit:
   0` if it doesn't exist yet — an admin has to raise it before Udhaar is
   usable, which is a deliberate soft gate).
2. `outstandingBalance + orderTotal <= creditLimit`, else reject the whole
   checkout with a clear "credit limit exceeded" error before any stock is
   touched.
3. The `draw` transaction posts on **delivery**, not on order placement —
   so a rejected or cancelled order never touched the ledger. (Stock
   reservation and credit-limit checking are deliberately different timing:
   stock is scarce and must lock immediately, credit isn't consumed until
   the goods actually change hands.)

---

## 6. Order status state machine

```
placed --(wholesaler confirms)--> confirmed --(wholesaler packs)--> packed
placed --(wholesaler rejects)--> rejected                 [stock released]
placed/confirmed --(retailer cancels)--> cancelled        [stock released]
packed --(admin assigns rider)--> assigned
assigned --(rider picks up)--> picked_up
picked_up --(rider delivers)--> delivered                 [payment/Udhaar settled]
assigned/picked_up --(rider reports failure)--> delivery_failed  [stock released]
```

`delivery_failed` has no automatic retry in v1 — an admin manually decides
whether to re-assign (new Delivery row against the same Order) or the
retailer re-orders. Flagged in §7 as a deferred item.

---

## 7. Phasing

Each phase is independently runnable and testable.

| Phase | Backend | Frontend |
|---|---|---|
| **1. Cart & checkout** | Cart/CartItem, checkout with stock-lock + MOQ validation, Order/OrderItem fan-out, `RetailerProfile.address` field | Retailer: cart screen, checkout screen (address confirm + payment method) |
| **2. Wholesaler order handling** | Order status transitions (confirm/reject/pack), stock release on reject | Wholesaler: incoming orders list + confirm/reject/pack actions |
| **3. Delivery** | DeliveryPartner entity + seed, Delivery entity, admin assignment, rider endpoints, `WholesalerProfile.address` field | Mandi Admin: unassigned deliveries + rider picker; minimal Rider screens (assigned list, pick-up/deliver/fail buttons) |
| **4. Udhaar & COD settlement** | UdhaarAccount/UdhaarTransaction, Payment entity, credit-limit check at checkout, ledger posting at delivery | Retailer: wallet screen (limit/outstanding/history); Order detail shows payment status |

Suggested order: 1 → 2 → 3 → 4. Phase 1 is the centerpiece — nothing else
in this module means anything until an Order can exist — but Phase 3
(delivery) and Phase 4 (Udhaar) are independent of each other and could run
in either order once 1 and 2 land.

---

## 8. Decisions I'm making unless told otherwise

- **Rider gets a minimal in-app screen, not a separate app.** Same reasoning
  as giving Mandi Admin a screen in the existing RN app rather than a
  separate console — a dedicated rider app is a reasonable future
  investment once delivery volume justifies it, but building one now would
  block this module on unrelated app-shell work.
- **One Delivery per Order, not batched multi-order rider trips.** A rider
  picking up 4 orders from the same wholesalers in one trip is a real
  operational pattern eventually, but batching adds real scheduling
  complexity; v1 treats every delivery independently and an admin can still
  hand-assign the same rider to several deliveries back to back.
- **Address is plain text for both profiles**, not structured
  street/city/pincode/geo fields. Mandis are small enough that "shop 12,
  Sabzi Mandi Road, near water tank" is exactly how this already works
  offline; structured address + geocoding is worth doing once delivery
  volume needs route optimization.

---

## 9. New deferred items (to add to TODO.md)

- No automatic retry/re-assignment after a failed delivery — admin does it
  manually by re-assigning a fresh Delivery row.
- No rider trip batching — every delivery is scheduled independently.
- Address is free text with no geocoding — no map view, no route
  optimization for riders.
- Udhaar credit limit is still fixed/manually-set (per existing TODO); this
  module only wires the draw/repayment ledger against that limit, it does
  not build the recommendation engine.
- No partial delivery / partial return handling — an order is delivered or
  it fails, in full.
- No online payment gateway (Razorpay/Cashfree) — COD and Udhaar only, per
  the decision above.
- No repayment collection flow for Udhaar — `UdhaarTransaction.repayment`
  rows can be posted (e.g. by an admin) but there's no retailer-facing "pay
  down my Udhaar" screen yet.

---

## 10. Resolved

1. **Checkout unit** — one Order per wholesaler, not one Order per cart. (§1)
2. **Stock reservation** — row-locked decrement at checkout, released on
   reject/cancel/failed-delivery. (§4)
3. **Udhaar timing** — credit-limit checked at checkout, ledger posted at
   delivery, not at placement. (§5)
4. **Delivery ownership** — platform-owned via manually-seeded riders
   assigned by Mandi Admins, not wholesaler self-fulfillment. (§1, §3)
