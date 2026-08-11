# Implementation Plan — Products, Aliases & KYC

Covers the next module after Users & Auth: the master product catalogue,
wholesaler listings, the SKU submission/moderation flow, product alternative
names, and KYC verification.

## Decisions taken

| Question | Decision |
|---|---|
| SKU submission review | Admin can **approve as new**, **merge into existing**, or **reject** |
| Alias sources | **Admin-curated + auto-captured** when a submission is merged |
| KYC scope | **Both roles now** — wholesaler KYC → their Mandi Admin; retailer KYC → shared queue |
| File storage | **Local disk now**, behind an S3-swappable interface |
| Pack size | **Structured `{ value, unit }`** from a fixed unit list — no free text |
| Listing an existing product | **No moderation** — wholesaler lists it instantly; only *new products* get reviewed |
| MRP & all pricing | **Per wholesaler listing**, not on the master product |

---

## 1. Core modelling decision: Products vs Listings

The prototype's product page shows several wholesalers selling *the same
product* at different prices, each with their own MOQ, distance and rating
("2 sellers", "BEST PRICE" badge). That only works with a two-level model:

- **`Product`** — the master catalogue entry. One row for "Aashirvaad Atta,
  5 kg", platform-wide, admin-approved. Not mandi-scoped.
- **`WholesalerListing`** — one wholesaler's *offer* of that product: their
  price, stock, and MOQ. Mandi-scoped via the wholesaler.

Everything else in this module hangs off that split. A flat
one-product-per-wholesaler model would make the price-comparison PDP
impossible and fill the catalogue with near-duplicate rows.

**Note / open item:** `Product` being global means a Delhi mandi admin
approving a new product makes it visible to every mandi. That's the correct
behaviour for a *master* catalogue, but it does mean cross-mandi blast radius
from a single admin's approval. Flagging it now; if that's not acceptable
we'd need either platform-level approval for new products, or a
per-mandi visibility flag.

---

## 2. Data model

### Category
Seeded from the prototype's taxonomy (Atta & Flour, Rice & Grains, Oils &
Ghee, Dals & Pulses, Masale, Sugar & Salt, Tea & Beverages, Snacks, Dairy,
Home & Clean).

```
id, slug (unique), nameEn, nameHi, icon, tint, sortOrder
```

### Product — master catalogue
```
id, name, brand?, categoryId,
packValue (decimal), packUnit (enum),          -- e.g. 5 + 'kg'
packBaseValue, packBaseUnit (g | ml | count),  -- derived, for dedup/compare
imagePath?, status: active | archived, createdAt, updatedAt
```

**No price or MRP here.** All pricing lives on the wholesaler's listing.

Pack size is a structured `{ value, unit }` pair chosen from a fixed unit
list — never free text — so "5kg", "5 Kg" and "5 kg" can't diverge into three
products. On save we also derive a canonical base measure so equivalent packs
compare cleanly:

| Entered | Stored base |
|---|---|
| 5 kg | 5000 g |
| 500 g | 500 g |
| 1 L | 1000 ml |
| 1 dozen | 12 count |
| 12 piece | 12 count |

Note the last two collapse to the same base, which is exactly what we want
for duplicate detection.

**Allowed units:** `kg`, `g`, `l`, `ml`, `piece`, `dozen`, `packet`, `bag`,
`box`. Container-ish units (`packet`/`bag`/`box`) normalise to `count`, since
their real weight varies by product.

### ProductAlias — the "alt names"
```
id, productId, alias, locale: en | hi | other,
source: admin | merge | system, createdAt
unique (productId, lower(alias))
```

Aliases exist so search works the way shopkeepers actually talk: `आटा`,
`atta`, `flour`, `gehu ka atta` should all reach the same product. The
`locale` field keeps Devanagari and romanized spellings side by side; `source`
tells us whether a human curated it or it fell out of a merge.

### WholesalerListing
```
id, productId, wholesalerProfileId, mandiId,
pricePerUnit, mrp?, stockUnits, moq (default 1),
status: active | inactive, createdAt, updatedAt
unique (productId, wholesalerProfileId)
```

**Everything commercial sits here**, MRP included — two wholesalers may
quote different MRPs for the same master product, and the retailer's
"savings vs MRP" is therefore per-seller. Promotions, coupons and deal
pricing extend this table in the next module.

`mandiId` is denormalised off the wholesaler so retailer-facing queries can
filter by mandi without a join. Stock status (in / low / out) is derived from
`stockUnits`, not stored.

### SkuSubmission — the moderation queue
```
id, wholesalerProfileId, mandiId,
proposedName, categoryId, packSize, pricePerUnit, stockUnits, moq,
status: pending | approved | merged | rejected,
reviewedByAdminId?, reviewedAt?, reviewNote?,
resultingProductId?, resultingListingId?, createdAt
```

Keeping submissions as their own table (rather than a `pending` flag on
Product) gives an audit trail of who submitted what, what the admin decided,
and why — and lets a rejected submission be revisited without polluting the
catalogue.

### KycSubmission + KycDocument
```
KycSubmission:
  id, userId, subjectType: retailer | wholesaler,
  businessName, ownerName, gstin, pan,
  status: pending | verified | rejected,
  reviewMandiId?,            -- set for wholesalers, null for retailers
  reviewedByAdminId?, reviewedAt?, reviewNote?, createdAt

KycDocument:
  id, kycSubmissionId, type: shop_proof | pan_card,
  storagePath, mimeType, sizeBytes, uploadedAt
```

`reviewMandiId` is what routes the queue: wholesaler submissions carry their
mandi and only that mandi's admin sees them; retailer submissions leave it
null and land in a shared queue any mandi admin can action (retailers aren't
mandi-scoped, so there's no natural owner).

---

## 3. Endpoints

### Public / retailer
```
GET  /categories
GET  /products?q=&categoryId=&mandiId=&page=     search across name + aliases
GET  /products/:id                                product + active listings, cheapest first
```

### Wholesaler (JWT + @Roles('wholesaler'))
```
GET    /wholesaler/listings                       my inventory
POST   /wholesaler/listings                       { productId, pricePerUnit, mrp?, stockUnits, moq }
                                                  -- existing product, goes live immediately
PATCH  /wholesaler/listings/:id                   price / MRP / stock / MOQ / active
DELETE /wholesaler/listings/:id                   stop stocking this product
POST   /wholesaler/sku-submissions                only when the product does NOT exist yet
GET    /wholesaler/sku-submissions                my submissions + statuses
```

The wholesaler journey is **search-first**: they search the master catalogue,
and if the product is there they list it instantly with their own price and
stock — no admin in the loop. Only when nothing matches do they raise a new
product request, which is the thing that actually warrants review. This keeps
the moderation queue small and duplicates rare, because listing an existing
product is always the path of least resistance.

### Mandi Admin (JWT + @Roles('mandi_admin'), scoped to own mandi)
```
GET  /admin/sku-submissions?status=pending
GET  /admin/sku-submissions/:id/suggestions       near-match products to merge into
POST /admin/sku-submissions/:id/approve           -> new Product + Listing
POST /admin/sku-submissions/:id/merge             { productId } -> Listing + alias
POST /admin/sku-submissions/:id/reject            { note }

POST   /admin/products                            create master product directly
PATCH  /admin/products/:id
GET    /admin/products/:id/aliases
POST   /admin/products/:id/aliases                { alias, locale }
DELETE /admin/products/:id/aliases/:aliasId

GET  /admin/kyc?status=pending
POST /admin/kyc/:id/verify
POST /admin/kyc/:id/reject                        { note }
```

### KYC (any authenticated user)
```
POST /kyc/documents        multipart upload -> { documentId }
POST /kyc/submissions      { subjectType, businessName, ownerName, gstin, pan, documentIds[] }
GET  /kyc/me               my submission(s) + status
GET  /files/:id            auth-gated document fetch
```

**`/files/:id` must not be public.** KYC documents are PAN cards and shop
proofs. The route will authorize on: the uploading user, or a mandi admin
entitled to review that submission. Nothing else.

### Validation
- GSTIN — `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`
- PAN — `^[A-Z]{5}[0-9]{4}[A-Z]$`
- Format-only. Real government verification (Digilocker / Signzy / Karza)
  stays deferred in `TODO.md`.

---

## 4. Match suggestions (the merge helper)

When an admin opens a pending submission, we suggest existing products it
might be a duplicate of, so merging is the easy path and creating duplicates
takes deliberate effort.

Ranking inputs, cheapest-first:
1. Exact case-insensitive match on product name or any alias
2. Postgres trigram similarity (`pg_trgm`) on name + aliases
3. Same category + same normalised pack size as a tie-breaker

`pg_trgm` is a built-in Postgres extension — enabled with one migration
statement, no new infrastructure.

---

## 5. Storage service

```
StorageService (interface)
  save(buffer, { filename, mimeType }) -> { id, path }
  read(path) -> stream
  delete(path)

LocalDiskDriver  -> ./uploads/<yyyy>/<mm>/<uuid>.<ext>   (gitignored)
S3Driver         -> later, same interface
```

Driver selected by `STORAGE_DRIVER=local|s3`. Call sites never touch the
driver directly, so swapping to S3/R2 later is a config change plus one new
file — no changes to controllers or services.

---

## 6. Phasing

Each phase is independently runnable and testable.

| Phase | Backend | Frontend |
|---|---|---|
| **1. Catalogue foundation** ✅ | Category + Product + ProductAlias entities, seed categories, admin product/alias CRUD, `/products` search | Retailer: category browse + product list + PDP |
| **2. Listings & inventory** ✅ | WholesalerListing, wholesaler listing endpoints, PDP shows all sellers | Wholesaler: inventory screen with stock steppers |
| **3. Submission & moderation** | SkuSubmission, match suggestions, approve/merge/reject, alias auto-capture | Wholesaler: "List new SKU" form + my submissions; Admin: moderation queue |
| **4. KYC** | StorageService, document upload, submission, admin review queue, auth-gated file serving | KYC form + status screens, admin review screen |

Suggested order: 1 → 2 → 3 → 4. Phase 3 is the centrepiece (it's where alias
capture happens) but it depends on 1 and 2 existing.

---

## 7. Decision I'm making unless told otherwise

**Mandi Admin gets screens inside the React Native app for now**, rather than
waiting on a separate web console. Moderation is unusable without a UI, and
the admin already logs in through the same auth flow. A proper Next.js admin
console can come later and reuse every endpoint above unchanged.

This also fixes an existing gap: `App.tsx` currently routes only Retailer and
Wholesaler profiles, so a seeded Mandi Admin logs in and lands nowhere.

---

## 8. New deferred items (to add to TODO.md)

- Real KYC verification against government APIs — format validation only for now
- Product images: schema field + upload path exist, but no image pipeline
  (resize/CDN); the app keeps using the generated Packshot component
- Cross-mandi blast radius of global product approval (see §1)
- Alias capture from unmatched retailer searches — deliberately not built
- No bulk SKU import (CSV/Excel) for wholesalers with large catalogues
- Rejected submissions have no resubmission/appeal flow

---

## 9. Resolved

1. **Pack size** — structured `{ value, unit }` from a fixed unit list, with a
   derived canonical base measure. No free text. (§2)
2. **Listing an existing product** — no moderation; goes live instantly. Only
   genuinely new products enter the review queue. (§3)
3. **MRP** — per wholesaler listing, not per product. All pricing is
   wholesaler-level; promotions and pricing rules are the next module. (§2)
