# Mandi Bhai — Business Requirements Document

**Version:** 1.0
**Date:** 2026-08-13
**Status:** Draft for review
**Companion document:** [`PRD.md`](./PRD.md) — product/engineering specification, including the full "Gap: built vs. required" register.

---

## 0. Executive summary

Mandi Bhai is a B2B supply platform for Indian kirana (neighbourhood grocery) retailers. A retailer orders staples through the app before a daily cutoff and receives them the next morning.

**The business model has been redefined.** Mandi Bhai is not a marketplace. Mandi Bhai is the **merchant of record**: the retailer buys from Mandi Bhai, and Mandi Bhai separately buys from wholesalers. The retailer never learns which wholesaler supplied the goods.

- Retailer places **one order** with the platform.
- The platform internally raises **purchase orders (POs)** to one or more wholesalers.
- Revenue is a **per-product percentage markup** set by a super admin. No commission, no subscription, no listing fee.
- Selling price = **lowest currently-available wholesaler quote + markup %**.
- The retailer sees the selling price and the **mandi average rate** as a savings anchor. The raw lowest quote is never shown.

**The code built to date implements a different model** — an open marketplace with side-by-side wholesaler price comparison, per-wholesaler order fan-out, and an Udhaar (credit) ledger. Section 10 and the PRD's gap register enumerate exactly what must be reworked. This is a material rewrite of the commercial layer, not a UI adjustment.

---

## 1. Problem statement and market context

### 1.1 How kirana replenishment works today

An Indian kirana store owner replenishes stock through a mandi — a physical wholesale market. The current process:

| Step | Reality today | Cost to the retailer |
|---|---|---|
| Price discovery | Phone calls to 2–4 known wholesalers, or a physical visit | 1–3 hours per cycle |
| Negotiation | Verbal, per-transaction, relationship-priced | Price varies by who is asking |
| Ordering | Phone call or WhatsApp, no confirmation | Frequent short supply, no recourse |
| Transport | Retailer arranges a tempo, or shuts the shop and goes personally | ₹150–400 per trip, plus lost trading hours |
| Payment | Cash, or informal credit from a specific wholesaler | Credit locks the retailer to one supplier |
| Frequency | 2–4 times per week for fast movers | Compounding time cost |

### 1.2 The structural problems

1. **Price opacity.** A retailer cannot know the true market rate. Two retailers buying the same 5 kg atta on the same morning routinely pay different prices. The spread between the cheapest and dearest wholesaler in a single mandi is commonly 8–20%.
2. **Time cost.** The owner is usually the only person who can leave the shop, so procurement directly cannibalises trading hours.
3. **Fragmented supply.** No single wholesaler carries everything, so a full basket means several suppliers, several negotiations, and several pickups.
4. **Credit lock-in.** Informal credit from one wholesaler suppresses price shopping — the retailer cannot leave a supplier they owe money to.
5. **No reliability guarantee.** Short supply is discovered on arrival, not at order time.

### 1.3 Why this is addressable now

- Smartphone and UPI penetration among kirana owners is effectively universal.
- Vernacular-first, low-literacy UX patterns are proven in this segment.
- Wholesalers already operate on thin margins at high volume and will accept guaranteed order flow.
- Same-mandi, next-morning delivery is operationally tractable at neighbourhood scale — a mandi's catchment is small enough for a single rider batch.

---

## 2. The opportunity

### 2.1 What Mandi Bhai sells to each side

| Party | What they get | What they give up |
|---|---|---|
| **Retailer** | One price, one order, one delivery, next morning, no travel, demonstrable saving vs. mandi average | Supplier choice, direct relationship, informal credit (in v1) |
| **Wholesaler** | Guaranteed, aggregated order flow with no sales effort; no credit risk (platform pays) | Price transparency to the platform; loses the direct retailer relationship |
| **Platform** | Per-product markup on every unit sold; ownership of demand and of the price signal | Working capital exposure; delivery cost; margin risk on re-sourcing |

### 2.2 Positioning

Mandi Bhai's promise to the retailer is **"the mandi, without the mandi trip — and cheaper than your average"**. The competitive claim is not "the lowest price on the market" (which the platform cannot make while taking a markup). It is **price against the mandi average**, which is both defensible and honest: the platform sources at the minimum and prices below the average.

---

## 3. Target users and jobs-to-be-done

### 3.1 Retailer — kirana store owner (primary buyer)

| Attribute | Detail |
|---|---|
| Profile | Owner-operator, 1–3 staff, 150–600 sq ft, ₹30k–₹150k monthly purchase volume |
| Digital comfort | WhatsApp and UPI fluent; app-fluent for simple, repetitive flows |
| Language | Hindi/regional first; product names spoken colloquially (*haldi*, *atta*, *cheeni*) |

**Jobs to be done**

1. "Restock my fast movers before I run out, without shutting the shop."
2. "Know I am not being overcharged, without calling four people."
3. "Get one delivery, at a predictable time, that matches what I ordered."
4. "Re-order what I bought last week in under a minute."

### 3.2 Wholesaler (supply side)

| Attribute | Detail |
|---|---|
| Profile | Mandi-based stockist, 50–500 SKUs, sells to 20–200 retailers |
| Motivation | Volume with zero acquisition cost and zero credit risk |
| Constraint | Rates move daily; will not accept fixed long-term prices |

**Jobs to be done**

1. "Sell my stock without chasing retailers."
2. "Update my rate daily, in seconds, and have it count immediately."
3. "Get paid reliably, without carrying retailer credit risk."

### 3.3 Super admin (platform, NEW role)

Owns the master catalogue, product audits, markup rates, MOQ overrides, cutoff configuration, mandi creation, and margin reporting. Sees every wholesaler quote and every rupee of margin. **This role does not exist in the current codebase.**

### 3.4 Mandi admin (local operations)

Runs one mandi day-to-day: allocation overrides, rider assignment, local escalations, exception queue. Deliberately does **not** own pricing or the master catalogue.

### 3.5 Delivery partner / rider

Platform-employed or contracted. Picks up from one or more wholesalers, delivers to retailers on the morning batch.

---

## 4. Business model — managed reseller

### 4.1 The mechanic

```
Wholesaler quotes  ──►  Platform takes the MINIMUM in-stock quote
                             │
                             ├──►  + per-product markup %   ──►  SELLING PRICE (retailer sees)
                             │
                             └──►  used for sourcing        ──►  PO to that wholesaler (retailer never sees)

Mandi average of all quotes  ──►  ANCHOR PRICE (retailer sees, as "you saved ₹X")
```

Two objects, always distinct:

- **Customer order** — retailer ↔ Mandi Bhai. One per checkout. Carries the selling price.
- **Purchase order (PO)** — Mandi Bhai ↔ wholesaler. One per sourced wholesaler per batch. Carries the wholesaler's quoted price.

### 4.2 Worked numeric example

Product: *Aashirvaad Atta, 5 kg*. Four wholesalers quote in one mandi on a given morning.

| Wholesaler | Quote (₹) | Stock | MOQ | In sourcing set? |
|---|---|---|---|---|
| W1 | 38.00 | 400 | 10 | **Yes — minimum, in stock** |
| W2 | 42.00 | 150 | 5 | Fallback #1 |
| W3 | 48.00 | 900 | 25 | Fallback #2 |
| W4 | 56.00 | 0 | 10 | No — out of stock |

**Derived figures**

| Figure | Calculation | Value |
|---|---|---|
| Minimum available quote | min(38, 42, 48) — W4 excluded, no stock | **₹38.00** |
| Mandi average (anchor) | mean of {₹38} ∪ {quotes above ₹38, in stock or not} = (38 + 42 + 48 + 56) / 4 | **₹46.00** |
| Markup % (super admin config) | per-product | **10%** |
| **Selling price** | 38.00 × 1.10 | **₹41.80** |
| **Retailer saving vs. average** | 46.00 − 41.80 | **₹4.20 (9.1%)** |
| **Platform gross margin** | 41.80 − 38.00 | **₹3.80 (9.1% of selling price)** |

**What each party sees for this transaction**

| Figure | Retailer | Wholesaler W1 | Wholesaler W2 | Mandi admin | Super admin |
|---|---|---|---|---|---|
| Selling price ₹41.80 | ✅ | ❌ | ❌ | ✅ | ✅ |
| Mandi average ₹46.00 | ✅ | ❌ | ❌ | ✅ | ✅ |
| Minimum quote ₹38.00 | **❌** | ✅ (own) | ❌ | ❌ | ✅ |
| All four quotes / spread | ❌ | ❌ | ❌ | ❌ | ✅ |
| Markup 10% | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Margin ₹3.80** | ❌ | ❌ | ❌ | **❌** | **✅ only** |
| Supplier identity (W1) | **❌** | n/a | ❌ | ✅ | ✅ |

The minimum quote is withheld from the retailer deliberately: showing both ₹38.00 and ₹41.80 lets anyone compute the markup exactly, which invites disintermediation and rate pressure. The mandi average serves the retailer's actual need — *"am I getting a good price?"* — without disclosing the platform's cost basis.

### 4.3 Margin under re-sourcing — markup is always preserved

**Resolved decision (D4, revised):** the markup percentage is **fixed per product and always preserved**. The selling price is *always* recomputed as `wholesaler cost + markup %` at every validation point, including when re-sourcing after a shortfall. The platform never absorbs a cost increase.

The structural consequence is important: **margin can never go negative, so there is no margin floor and nothing for the engine to refuse on economic grounds.** In absolute rupees, margin actually *rises* as cost rises, because it is a percentage.

| Step | Event | Cost | Price (cost + 10%) | Margin | Outcome |
|---|---|---|---|---|---|
| 1 | W-A quotes ₹38 → retailer confirms | ₹38.00 | **₹41.80** | **+₹3.80** | Sold |
| 2 | W-A short at pickup → re-source to W-B at ₹40 | ₹40.00 | **₹44.00** | **+₹4.00** | Retailer approval requested |
| 3 | W-B short → next is W-C at ₹43 | ₹43.00 | **₹47.30** | **+₹4.30** | Retailer approval requested |

**The cost lands on the retailer, not the platform** — and because the retailer has already confirmed ₹41.80, they must be asked to approve the new price before it can be charged. The same applies if the replacement wholesaler's MOQ exceeds the ordered quantity: the retailer is asked to raise it.

This converts the exposure from a **margin risk into a fill-rate risk**. The platform's margin is safe in every scenario; what is at risk is whether the retailer approves in time. A retailer who does not respond before the delivery run leaves is treated as declining, and the line is cancelled (§4.3.1).

Two consequences the build must carry:

- The allocation engine needs **no margin check at all**. Eligibility is stock and MOQ only.
- The system needs a **retailer approval loop that runs after cutoff**, reaching the retailer out-of-band and resolving before the delivery run departs. This is a materially harder problem than the margin floor it replaces, and it depends entirely on a notification channel that is currently stubbed (R13).

#### 4.3.1 Silence is not consent

If the retailer does not respond to a re-source approval request before the delivery run leaves, the line is **auto-declined and cancelled**, and the remainder of the order delivers normally. The platform never charges more than the retailer approved.

This costs fill rate — the line is lost — but the alternative is a rider arriving to collect more cash than the app displayed, which produces refused deliveries and disputes the platform cannot win. **Revenue lost to unanswered approval requests must be a first-class line in super admin reporting**; it is the model's largest silent leakage now that margin compression has been eliminated.

### 4.4 Revenue model exclusions

Explicitly **not** part of the model: commission on wholesaler sales, wholesaler subscription or listing fees, retailer subscription, advertising or placement fees, credit/interest income (in v1 — Udhaar is removed and appears only in the vision tier).

---

## 5. Why managed reseller over marketplace

The codebase and both PLAN documents describe a marketplace. That direction has been reversed. The reasoning, and the costs:

### 5.1 What managed reseller buys

| Benefit | Explanation |
|---|---|
| **Pricing power** | The platform owns the price. In a marketplace, wholesalers set prices and compete the platform's take-rate toward zero. |
| **No disintermediation** | The retailer cannot call the wholesaler directly next week, because they never learn who it was. This is the single strongest defensive property of the model. |
| **Simple buyer UX** | One price, one order, one delivery. Comparison shopping is cognitive work the retailer does not want to do at 8 PM. |
| **Sourcing arbitrage** | The platform captures the mandi spread (8–20%) rather than passing it through. |
| **Supply substitutability** | Because the retailer has no supplier relationship, any wholesaler can be swapped for any other without the customer noticing — this is what makes auto re-sourcing possible at all. |
| **Demand aggregation upside** | Owning the order book enables future bulk negotiation, private label, and direct-from-mill sourcing. None of that is possible if wholesalers own the customer. |

### 5.2 What it trades away

| Cost | Explanation | Mitigation |
|---|---|---|
| **Balance-sheet risk** | The platform owes the wholesaler regardless of whether the retailer pays. Marketplace models never carry this. | COD collected at delivery; prepaid encouraged; strict per-retailer exposure caps |
| **Fill-rate risk on exceptions** | Short supply or quality rejection raises the price, which the retailer must approve after cutoff; silence cancels the line (§4.3) | Markup is preserved so margin is never at risk; the exposure is unfilled lines. Mitigated by supplier depth per SKU and by a reliable notification channel (R13) |
| **Quality liability** | Mandi Bhai is the merchant of record, so a bad sack of atta is Mandi Bhai's problem | Quality check at pickup; rejection triggers re-source, not a customer-facing failure |
| **Slower catalogue growth** | Every new product needs a super admin audit; marketplaces let sellers self-list | Existing-product price updates go live instantly; only genuinely new products queue |
| **Wholesaler resentment risk** | Suppliers become anonymous commodity vendors with no brand equity | Guaranteed volume, prompt payment, zero credit risk, zero acquisition cost |
| **Operational load** | Allocation, POs, batching, and exceptions are platform work that a marketplace pushes onto sellers | Automate allocation fully; humans only handle exceptions |

### 5.3 The decision in one line

A marketplace optimises for catalogue breadth and asset-light growth; a managed reseller optimises for margin capture, customer ownership, and buyer simplicity. Mandi Bhai is choosing the latter, accepting working-capital and quality liability as the price.

---

## 6. Unit economics

### 6.1 Per-order model (illustrative, one mandi)

| Line | Assumption | Value |
|---|---|---|
| Average order value (AOV) | 12–18 lines, staples-weighted | ₹4,000 |
| Blended markup | mix of 6–14% by category | 9.5% |
| **Gross margin per order** | 4,000 × 9.5 / 109.5 | **₹347** |
| Delivery cost per order | batched, ~12 drops/rider/morning | ₹95 |
| Payment/collection cost | COD handling + reconciliation | ₹15 |
| Revenue lost to declined/unanswered re-source approvals | ~4% of lines re-sourced; assume half go unapproved and cancel (§4.3.1). No margin is lost — the line simply does not sell | ₹7 |
| Wastage / quality rejection | ~0.8% of order value | ₹32 |
| **Contribution per order** | 347 − 95 − 15 − 7 − 32 | **₹198 (5.0% of AOV)** |

These figures are assumptions for modelling, not measurements. Every one of them is a KPI in §7 precisely because it must be replaced with observed data in pilot.

### 6.2 The levers, ranked by sensitivity

| # | Lever | Mechanism | Why it matters |
|---|---|---|---|
| 1 | **Markup % by product** | Super admin config, per product | Direct, immediate, and the only lever fully under platform control. Elastic staples (atta, oil, sugar) tolerate 5–8%; differentiated goods (masale, snacks) tolerate 12–18%. |
| 2 | **Sourcing spread** | More quoting wholesalers per product → lower minimum | Adding a 4th and 5th quoter to a product typically lowers the minimum 3–6% at zero cost to the retailer's price |
| 3 | **Drops per rider per morning** | Batch density within a mandi catchment | Delivery is the largest cost line; going from 8 to 14 drops cuts per-order delivery cost ~40% |
| 4 | **AOV / lines per order** | Basket completeness — catalogue coverage | Delivery cost is per-drop, not per-line, so every added line is nearly pure margin |
| 5 | **Re-sourcing rate** | Quote accuracy and stock-truth discipline | No longer a margin lever — markup is preserved (§4.3). It is now a **fill-rate** lever: every re-source triggers a post-cutoff approval request, and each unanswered one cancels a line. Driven by wholesaler stock hygiene |
| 6 | **Order frequency** | Habit formation, "buy again" | Amortises acquisition cost; frequency is the leading indicator of retention |
| 7 | **Catalogue duplication rate** | Product audit quality | Duplicates split quotes across two entries, raising the computed minimum on both — a silent, permanent margin tax |
| 8 | **Prepaid share** | Payment mix | Reduces cash handling cost, reconciliation load, and collection risk |

### 6.3 The duplication tax, made concrete

If "Aashirvaad Atta 5 kg" exists twice in the catalogue, and W1 (₹38) quoted entry A while W2 (₹42) quoted entry B:

- Entry A minimum = ₹38, entry B minimum = ₹42.
- A retailer landing on entry B pays 42 × 1.10 = ₹46.20 instead of ₹41.80.
- The platform's margin is unchanged in percentage terms but the retailer's saving claim collapses from ₹4.20 to −₹0.20 against the average.

Catalogue duplication does not just look untidy — **it breaks the core value proposition and the sourcing engine simultaneously**. This is why new-product audit with duplicate detection is a business control, not a data-hygiene chore.

---

## 7. Success metrics and KPIs

### 7.1 North star

**Weekly delivered order volume per active mandi.** It compounds retention, catalogue coverage, and delivery density in one number.

### 7.2 KPI tree

| Layer | Metric | Definition | Pilot target |
|---|---|---|---|
| **Demand** | Weekly active retailers | ≥1 delivered order in 7 days | 120 per mandi by month 3 |
| | Order frequency | Delivered orders per active retailer per week | ≥1.8 |
| | AOV | Delivered order value | ₹4,000 |
| | Lines per order | Distinct products | ≥12 |
| | Repeat rate (M2) | Retailers ordering in month 2 having ordered in month 1 | ≥65% |
| **Price** | Saving vs. mandi average | (avg − selling) / avg, delivered-weighted | ≥8% |
| | Quotes per product | Active in-stock quotes on ordered products | ≥3.5 |
| | Realised blended markup | margin / cost, delivered | 9–11% |
| **Supply** | Quote freshness | % of ordered lines whose quote was updated in the last 24 h | ≥85% |
| | Stock-truth rate | 1 − (short-supplied lines / PO lines) | ≥96% |
| | Active quoting wholesalers | ≥1 price update in 7 days | 25 per mandi |
| **Fulfilment** | On-time delivery | Delivered within the promised morning window | ≥95% |
| | Order fill rate | Delivered units / ordered units | ≥98% |
| | Re-source rate | Lines re-sourced / total lines | ≤4% |
| | Drops per rider per morning | | ≥12 |
| **Financial** | Gross margin per order | Revenue − COGS | ₹347 |
| | Margin lost to re-sourcing | Reported separately, always | ≤6% of gross margin |
| | Contribution per order | After delivery, payment, wastage | ₹183 |
| | COD collection leakage | Uncollected / delivered COD value | ≤0.3% |
| **Catalogue** | Duplicate rate | Merged-as-duplicate / new-product submissions | ≤5% after month 2 |
| | Audit turnaround | Submission → decision | <24 h, p90 |
| | Search success rate | Searches leading to add-to-cart | ≥45% |

### 7.3 Guardrail metrics

Metrics that must **not** degrade while growth metrics improve: negative-margin line rate, retailer complaint rate per 100 orders, wholesaler churn, price-approval queue age, and share of orders with a price-change confirmation prompt (a proxy for quote instability, which erodes trust).

---

## 8. Operating model and org implications

### 8.1 The daily cycle (one mandi)

| Time | Actor | Activity |
|---|---|---|
| Through the day | Wholesalers | Update price and stock; submit new products |
| Through the day | Retailers | Browse, cart, order |
| **Cutoff (e.g. 20:00, configurable per mandi)** | System | Batch closes for the day |
| Cutoff + minutes | System | Allocation engine runs: group lines by cheapest in-stock wholesaler meeting MOQ; emit POs |
| Evening | Mandi admin | Review exception queue (unsourceable lines, MOQ conflicts, negative-margin lines) |
| Early morning | Riders | Pick up against POs; quality check; short supply → auto re-source within batch |
| Morning | Riders | Deliver to retailers; collect COD |
| Morning, at pickup | System | **Wholesaler paid on delivery of goods to the rider** (§8.4) |
| Post-delivery | System / mandi admin | Reconcile POs, close batch |

### 8.2 Roles and headcount implications

| Function | Who | Scaling behaviour |
|---|---|---|
| Catalogue & product audit | Super admin (central) | Sub-linear — one central team serves all mandis; load spikes only at new-mandi launch |
| Markup & pricing policy | Super admin (central) | Fixed — a pricing analyst function, not per-mandi |
| Allocation | **Automated** | Zero marginal headcount; humans handle exceptions only |
| Mandi operations | Mandi admin, 1 per mandi | Linear in mandis, not in orders |
| Delivery | Riders | Linear in drops, improved by batch density |
| Wholesaler onboarding | Field/BD | Front-loaded per mandi, then maintenance |
| Finance / settlement | Central | Sub-linear with automation of PO reconciliation |

### 8.3 What is new operationally versus what exists

**New capabilities the business must stand up:** a central catalogue/pricing function (super admin), daily batch operations with a hard cutoff, PO issuance and wholesaler settlement, quality inspection at pickup, and a margin reporting discipline that separates earned margin from re-sourcing leakage.

**Already operational in the build:** mandi-scoped admin, platform-owned rider assignment, and the pickup → deliver → fail rider loop.

### 8.4 Working capital

**Resolved decision: wholesalers are paid on delivery** — that is, when they hand goods to the rider, not on net-N terms.

The reasoning is a supply-acquisition one rather than a treasury one. Fast, reliable, no-questions payment is the strongest wedge Mandi Bhai has for recruiting and retaining wholesalers, precisely because it is the opposite of how mandi credit normally works. Wholesalers currently carry retailer credit risk and chase payment; removing both is worth more to them than a marginal price concession.

The float given up is small. COD is collected the same morning the goods are paid for, so the platform is out of pocket for hours, not weeks:

| Moment | Cash movement |
|---|---|
| Early morning, pickup | Platform pays wholesaler (cash out) |
| Same morning, delivery | Platform collects COD from retailer (cash in) |
| Before cutoff, prepaid orders | Cash in ahead of cash out |

The residual working-capital requirement is therefore roughly one morning's GMV, plus whatever COD fails to collect. It still scales linearly with GMV and remains a funded finance workstream — but the decision deliberately trades a small, predictable float for supply-side goodwill. Prepaid share (§6.2, lever 8) directly reduces even that.

---

## 9. Business capability roadmap (tiered)

Every capability below is tiered: **Shipped today** (verified in code), **Next** (near-term backlog including everything the pivot requires), **Vision** (longer term).

### 9.1 Buyer experience

| Tier | Capability |
|---|---|
| **Shipped today** | Phone+OTP login; category browse; alias-aware search (Hindi/romanised); product detail; cart with live price/stock/MOQ validation; checkout; order list and detail; "Buy Again"; profile with address |
| **Next** | Single platform price replacing seller comparison; mandi-average savings display; supplier identity fully hidden; cart-open and place-order re-validation with explicit price-change confirmation; cutoff countdown and next-morning delivery promise; prepaid payment option |
| **Vision** | Personalised reorder prediction; basket-completion prompts; price-trend view per product; vernacular voice search; margin-safe loyalty/rewards |

### 9.2 Pricing

| Tier | Capability |
|---|---|
| **Shipped today** | Per-listing flat price; per-listing optional MRP with a savings-vs-MRP calculation; MRP sanity check (MRP cannot be below price) |
| **Next** | Per-product markup configuration (super admin); minimum-quote sourcing price; mandi-average computation and storage; selling-price derivation; price-change threshold approvals; full price-change audit trail |
| **Vision** | Dynamic/elastic markup by demand and stock position; category- and mandi-level markup policies; competitor rate intelligence; forward pricing on volatile commodities |

### 9.3 Supply and sourcing

| Tier | Capability |
|---|---|
| **Shipped today** | Wholesaler listings with price, stock, MOQ; inventory screen with stock value summary; stock reservation via row-locked decrement at checkout; stock release on reject/cancel/failed delivery |
| **Next** | Automatic cheapest-in-stock allocation meeting MOQ; internal PO generation; auto re-source on short supply or quality rejection; MOQ override by super admin; quality check at pickup; exception queue |
| **Vision** | Demand aggregation and forward buying; multi-mandi sourcing; direct-from-mill and private label; wholesaler scorecards and preferential allocation; bulk SKU import |

### 9.4 Catalogue

| Tier | Capability |
|---|---|
| **Shipped today** | Master products (global), categories, structured pack sizes with canonical base units, multilingual aliases, admin product/alias CRUD |
| **Next** | Wholesaler new-product submission; super admin full audit (identity + duplicate check with merge suggestion); approval gate before retailer visibility; price-only review for existing products |
| **Vision** | Product imagery pipeline; trigram/semantic search ranking; automated duplicate detection; alias capture from failed searches; catalogue analytics |

### 9.5 Fulfilment

| Tier | Capability |
|---|---|
| **Shipped today** | Platform-owned riders (seeded); mandi admin assigns rider to a packed order; rider marks picked-up / delivered / failed; one delivery per order |
| **Next** | Configurable per-mandi daily cutoff; one batch per mandi per day; next-morning delivery window; multi-pickup rider runs against POs |
| **Vision** | Route optimisation and geocoding; rider trip batching by proximity; slot-based delivery; partial delivery and returns; rider app; multi-city operations |

### 9.6 Payments

| Tier | Capability |
|---|---|
| **Shipped today** | COD with rider collection; Udhaar credit ledger with admin-set limits; `Payment` entity decoupled from `Order` |
| **Next** | COD retained; online prepaid added behind a **stubbed, swappable gateway interface**; **Udhaar removed from scope** |
| **Vision** | Udhaar returns with data-driven limits from order history; embedded working-capital financing; wholesaler early-settlement products |

### 9.7 Platform administration

| Tier | Capability |
|---|---|
| **Shipped today** | Mandi admin role (seeded) with catalogue CRUD, delivery assignment, and Udhaar limit control |
| **Next** | **Super admin role (new)**: markup config, product audit, MOQ override, cutoff config, mandi creation, margin reporting. Mandi admin narrowed to local operations only. |
| **Vision** | Web admin console; role-based granular permissions; anomaly detection on quotes; full BI/analytics suite |

---

## 10. Gap between what is built and what the model requires

The full engineering register is in [`PRD.md` §4](./PRD.md). The business-level summary:

| # | Area | Built today | Required | Business impact |
|---|---|---|---|---|
| 1 | Commercial model | Marketplace: retailer picks a wholesaler | Managed reseller: platform is merchant of record | Fundamental — affects pricing, orders, UX, settlement |
| 2 | Supplier identity | Exposed in at least six places across API and UI | Hidden end to end | Disintermediation risk; core defensive property |
| 3 | Pricing | Wholesaler price shown directly | Min quote + markup, average as anchor | No revenue mechanism exists in code today |
| 4 | Markup | **No concept anywhere in the codebase** | Per-product %, super admin owned | The entire revenue model is unbuilt |
| 5 | Orders | One `Order` per wholesaler per checkout | One customer order + internal POs | Retailer sees fragmented orders and supplier names |
| 6 | Roles | retailer / wholesaler / mandi_admin / delivery_partner | **+ super admin** | Nobody can own markup, audit, or margin today |
| 7 | Sourcing | Retailer chooses manually | Automatic cheapest-in-stock allocation | No allocation engine exists |
| 8 | Delivery timing | Ad-hoc, per-order assignment | Per-mandi cutoff → next-morning batch | Delivery economics depend on batching |
| 9 | Price re-validation | Live price read; no change confirmation | Explicit confirmation at cart-open and place-order | Trust and margin risk |
| 10 | Product approval | **Never built** (PLAN Phase 3) | Full audit with duplicate detection | Duplicates break sourcing (§6.3) |
| 11 | Credit | Udhaar built end to end | **Descoped from v1** | Built capability being parked |
| 12 | Data safety | `synchronize: true` | Migrations | Blocks any real-data launch |

Items 4, 6, 7 and 10 are the ones with no code foundation at all. Items 1, 2, 3 and 5 are rework of shipped code. Item 11 is deliberate removal of working software.

---

## 11. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Unfilled lines from re-sourcing** — short supply raises the price, and the retailer must approve it after cutoff (§4.3) | High | Medium | Markup is always preserved, so **no margin is ever at risk**; the exposure is fill rate. Mitigated by supplier depth per SKU, penalising chronic stock misreporting, and by the notification channel in R13. Track revenue lost to unanswered approvals as a distinct KPI |
| R2 | **Disintermediation** — retailer and wholesaler transact directly | Medium | Critical | Hide supplier identity absolutely (packaging, invoices, rider scripts, and every API payload); make convenience and batching the moat |
| R3 | **Wholesaler concentration** — one supplier wins most volume in a mandi and gains pricing power | High | High | Minimum active-quoter targets per product; monitor share-of-PO by wholesaler; recruit continuously |
| R4 | **Cash handling on COD** — leakage, theft, reconciliation load | Medium | Medium | Push prepaid; per-rider cash limits; same-day deposit; automated reconciliation; collection variance alerting |
| **R4a** | **Unbounded per-retailer COD exposure — ACCEPTED RISK.** v1 ships with **no cap** on how much COD value a single retailer can have outstanding. Because wholesalers are paid at pickup (§8.4) while the retailer pays at delivery, a retailer can place an arbitrarily large COD order and simply not pay, and the platform has already paid for the goods. Nothing in the system limits this. | Medium | **High, unbounded** | **None in v1 — this risk is accepted, not mitigated.** Revisit as soon as real order-value distribution is observed in pilot; a per-retailer cap is the obvious first control but is deliberately not being built now |
| R5 | **Price volatility** — mandi rates move intraday, invalidating cart prices | High | Medium | Two-point re-validation with explicit confirmation; threshold-based approval on large swings; short cart TTL |
| R6 | **Catalogue duplication** — fragments sourcing and inflates computed minimums (§6.3) | High | High | Mandatory duplicate check in new-product audit; merge-suggestion as the default path; structured pack sizes; duplicate-rate KPI |
| R7 | **Working capital** — merchant-of-record obligation scales with GMV, and pay-on-delivery settlement (§8.4) forgoes the float a net-N term would give | Certain | Medium | Float is ~one morning's GMV by design; prepaid mix reduces it further; treat as a funded finance workstream. Deliberately traded for supply-side goodwill |
| R8 | **Quality liability** — Mandi Bhai owns the customer relationship and therefore the defect | Medium | Medium | Pickup quality check; rejection triggers re-source; complaint rate as a guardrail KPI |
| R9 | **Wholesaler disengagement** — anonymity plus price pressure reduces participation | Medium | High | Guaranteed volume, prompt settlement, zero credit risk, zero acquisition cost; monitor active-quoter count |
| R10 | **MOQ drift** — the cheapest supplier's MOQ can rise between browse and order, invalidating the retailer's quantity | Medium | Low | **Resolved** (§14, D1): the retailer is asked to raise the quantity or drop the line. Margin protected; residual risk is checkout friction and some lost lines |
| R11 | **Regulatory — GST and invoicing as merchant of record. STILL OPEN, and now the only unresolved blocker.** Being the merchant of record implies GST liability, a compliant invoice to every retailer, and possible FSSAI obligations on staples. | Certain | High | **Not yet resolved — requires the user's finance/CA sign-off.** This is a legal prerequisite for Phase 1 and may force tax fields into the schema (§14, O1). No amount of product work removes it |
| R12 | **Integration debt** — SMS, push, payments and storage are all stubbed | Certain | Medium | Swappable driver interfaces already the established pattern; sequence real providers ahead of pilot |
| R13 | **Notifications became load-bearing for fulfilment** — the D4 re-source approval loop must reach a retailer out-of-band, potentially around 4am, and get an answer before the delivery run leaves. The driver is currently `ConsoleNotificationDriver`, which logs to a terminal. Without a real provider, **every shortfall auto-declines and fill rate collapses.** | Certain | High | Promote SMS/push from deferrable stub to **launch prerequisite** (§12 of the PRD). Measure real overnight response rates during the pilot — if they are low, revisit whether small increases should auto-approve under disclosed terms rather than cancel |

---

## 12. Assumptions

| # | Assumption | If false |
|---|---|---|
| A1 | Wholesalers will quote daily prices honestly into the app | Sourcing minimum becomes unreliable; needs verification/audit layer |
| A2 | At least 3–5 wholesalers per product will quote in a mandi | Sourcing spread collapses; markup must come out of retailer value |
| A3 | Retailers accept not knowing the supplier | Core model fails; would force a marketplace reversion |
| A4 | Mandi average is a credible savings anchor to retailers | Positioning must shift to convenience-only |
| A5 | Next-morning delivery is sufficient (no same-day need) | Batch model breaks; delivery cost rises sharply |
| A6 | One rider batch per mandi per day meets demand | Requires multiple cutoffs or waves |
| A7 | COD is acceptable and manageable at pilot scale, **with no per-retailer exposure cap** (R4a) | Prepaid must be forced earlier and a cap built sooner than planned |
| A8 | Removing Udhaar will not materially suppress adoption | Credit returns to scope earlier than the vision tier |
| A9 | A 9–11% blended markup is tolerable to retailers given the saving | Markup must fall; delivery cost must fall to compensate |
| A10 | Pay-on-delivery settlement (§8.4) is a strong enough wedge to win wholesaler supply | If it isn't, price concessions or exclusivity terms become necessary, eroding markup |
| A11 | Mandi catchments are dense enough for ≥12 drops per rider | Delivery cost per order rises ~40% |
| A12 | Product audit can be centralised without becoming a bottleneck | Audit must be delegated or partially automated |

---

## 13. Phased business rollout

### Phase 0 — Pivot rebuild (pre-launch)

**Objective:** make the software match the business model.
**Scope:** super admin role, markup engine, single-price PDP, supplier anonymity, customer order + PO split, allocation engine, cutoff batching, product audit, re-validation flow, Udhaar descope, migrations.
**Exit criteria:** an order can be placed at a marked-up price, sourced automatically, PO'd, delivered, and settled — with no supplier identity visible to the retailer anywhere.

### Phase 1 — Single-mandi pilot

> **Blocking prerequisite: GST and invoicing sign-off (O1).** Phase 1 cannot start until the merchant-of-record tax treatment is settled with finance/a CA, because it may force schema changes. This is the only outstanding *legal* blocker.
>
> **Blocking prerequisite: a real notification provider (R13).** The D4 re-source approval loop is load-bearing for fulfilment and cannot run on the console stub. Unlike the other integrations, this one cannot ship stubbed.

**Objective:** validate that the unit economics in §6 survive contact with reality.
**Scope:** one mandi, 25 wholesalers, 100–150 retailers, 300–500 SKUs, COD only (no exposure cap — R4a), manual exception handling.
**Exit criteria:** ≥8% saving vs. average delivered to retailers; ≥95% on-time; ≤4% re-source rate; positive contribution per order; ≥65% M2 repeat.

### Phase 2 — Mandi replication

**Objective:** prove the model is repeatable and that central functions scale sub-linearly.
**Scope:** 3–5 mandis in one city; prepaid payments live; super admin margin reporting hardened; product audit SLA under load.
**Exit criteria:** new-mandi ramp to breakeven contribution in <8 weeks; central audit turnaround holds under <24 h p90.

### Phase 3 — City scale

**Objective:** density and cost reduction.
**Scope:** full city coverage; rider batching and route optimisation; bulk SKU import; wholesaler scorecards; category markup policies.
**Exit criteria:** delivery cost per order down ≥30% from pilot; ≥15 drops per rider.

### Phase 4 — Multi-city and financial products

**Objective:** expand the model and the revenue base.
**Scope:** second and third city; Udhaar reintroduced with data-driven limits; demand aggregation and forward buying; private label evaluation; ONDC evaluation.
**Exit criteria:** credit book performing within loss tolerance; aggregation delivering measurable sourcing improvement.

---

## 14. Decisions

### 14.1 Resolved

Kept rather than deleted, with the reasoning, so the audit trail survives. Prior identifiers are retained in brackets.

| # | Decision | Resolution | Reasoning |
|---|---|---|---|
| **D1** | **MOQ drift** [was B1] | **Always ask the retailer to raise the quantity.** Re-validation surfaces “minimum quantity is now 25”; the retailer raises it or drops the line. | Margin is protected, and the checkout friction is accepted as the lesser cost. Consequence: **MOQ is a hard constraint on allocation** — never something the platform absorbs by sourcing costlier. |
| **D2** | **Wholesaler settlement** [was B2] | **Pay on delivery** of goods to the rider. | Fast, reliable payment is a supply-acquisition wedge and the opposite of how mandi credit normally works. COD is collected the same morning, so the float forgone is roughly one morning's GMV (§8.4). |
| **D3** | **Markup band policy** [was B3] | **Percentage per product**, as already specified. | Per-product is the granularity the sourcing model needs. Category-level defaults are noted as a future convenience for large catalogues, not a v1 requirement. |
| **D4** | **Re-source pricing** [was B4] — *revised* | **Markup is fixed per product and always preserved.** The price is recomputed as `cost + markup %` at every validation point including re-source; the platform never absorbs a cost increase. The retailer must approve the new price (and any MOQ increase) after cutoff; no response before the delivery run leaves is treated as a decline and the line is cancelled. | Margin is structurally protected in every scenario, so no margin floor is needed. This supersedes the earlier "absorb up to the full markup, never negative" rule, which assumed a locked selling price. The exposure moves from margin compression to fill rate, and to the reliability of the notification channel (R13). Worked example in §4.3. |
| **D5** | **COD exposure cap** [was B6] | **No cap in v1.** | Logged as an explicitly **accepted risk** with unbounded per-retailer exposure — see **R4a**. To be revisited as soon as pilot reveals the real order-value distribution. |
| **D6** | **Mandi average rule** | Average = mean of {the in-stock minimum} ∪ {all quotes priced above it, in stock or not}; computed **within the retailer's own mandi**. | Full specification and its honest upward bias are in [`PRD.md` §5.1](./PRD.md). |
| **D7** | **Cancellation window** | **No cancellation after cutoff.** Cutoff is the commitment point, and must be communicated clearly at checkout before the retailer confirms. | POs are binding on issuance, so a post-cutoff cancellation would strand a purchase the platform has already committed to. |
| **D8** | **Aggregated demand visibility** | **Wholesalers quote blind** — pooled demand is never shown to them. | Showing pooled demand to competing suppliers in a small local market is a coordination signal. Price-fixing would break the cheapest-sourcing premise the entire model rests on. |
| **D9** | **Super admin structure** | **Single super admin role in v1.** | Splitting catalogue duties from pricing duties is a vision-tier refinement, not a launch requirement. |
| **D10** | **Savings display** | **Order total only.** No per-line savings anywhere in the retailer UI. | Keeps the pricing surface minimal and reduces the information available for reverse-engineering the markup. |
| **D11** | **Price swing band** | **15% global default, admin-tunable.** | Per-category bands need price history to calibrate, so they become a next/vision item once that history exists. |
| **D12** | **PO binding** | **Binding on issuance**, with a shortfall flag reportable any time before pickup. | Removes the accept/decline window entirely. Wholesalers cannot cherry-pick profitable POs, but genuine stock shortfalls still route into re-sourcing. |

### 14.2 Still open

| # | Question | Status |
|---|---|---|
| **O1** | **GST and invoicing as merchant of record** [was B5 / PRD Q11] | **NOT RESOLVED. The only unresolved *legal* blocker.** Being the merchant of record implies GST liability, a compliant invoice to every retailer, and possible FSSAI obligations on staples. It requires the user's finance/CA sign-off, is a **legal prerequisite for Phase 1**, and may force tax fields into the schema. No product decision removes it, and it cannot be deferred past pilot launch. |
| **O2** | **Markup can exceed the min-to-average spread, putting the price above the mandi average** | **NOT RESOLVED — raised, not yet ruled on.** The price is `min + markup` but the anchor is the mandi average, so whenever the markup exceeds the gap between them the retailer pays **above** the average. Verified: quotes {₹38, ₹39} at 10% markup → ₹41.80 against a ₹38.50 average, a real saving of **−₹3.30**. The display clamps to zero, which hides the number without changing the fact. This bears directly on whether the "you beat the mandi rate" claim in §2.1 is true on every SKU or only on wide-spread ones — settle it before that claim is used in retailer-facing marketing. Candidate mitigations (neither chosen): a super admin alert for products where markup exceeds the spread, or automatic markup compression on tight-spread items. See PRD §18.2 O2. |

---

*Companion: [`PRD.md`](./PRD.md) — personas, feature specs, state machines, data model, API surface, and the full built-vs-required gap register. PRD §18 carries the matching resolved-decision log at specification detail.*
