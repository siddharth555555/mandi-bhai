import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ListingStatus,
  StockStatus,
  WholesalerListing,
  stockStatusFor,
} from '../listings/wholesaler-listing.entity';
import { DEFAULT_MARKUP_PERCENT, ProductMarkup } from './product-markup.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What the retailer is allowed to see. Never carries cost or supplier. */
export type PlatformPrice = {
  productId: string;
  available: boolean;
  sellingPrice: number | null;
  mandiAverage: number | null;
  savingsVsAverage: number | null;
  effectiveMoq: number;
  stockStatus: StockStatus;
  availableUnits: number;
};

/** Internal only — sourcing detail. Never reaches a retailer response. */
export type SourcingQuote = {
  listingId: string;
  wholesalerProfileId: string;
  mandiId: string;
  costPerUnit: number;
  moq: number;
  stockUnits: number;
};

/**
 * The single source of truth for what a product costs and what it sells for.
 *
 * The platform is the merchant of record: it sources at the cheapest
 * *in-stock* quote and sells at that quote plus a per-product markup. The
 * retailer sees the selling price and the mandi average as an anchor — never
 * the underlying quote, because the two together reveal the markup exactly.
 *
 * Do not reimplement this arithmetic elsewhere; catalog, cart and checkout
 * all read through here so a price shown is always the price charged.
 */
@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(WholesalerListing)
    private readonly listings: Repository<WholesalerListing>,
    @InjectRepository(ProductMarkup)
    private readonly markups: Repository<ProductMarkup>,
  ) {}

  async priceFor(productId: string, mandiId?: string): Promise<PlatformPrice> {
    const map = await this.priceForMany([productId], mandiId);
    return map.get(productId) ?? unavailable(productId);
  }

  /**
   * Batch variant for product lists. One query for listings, one for markups —
   * the per-product maths is done in memory because the averaging rule
   * (below) doesn't express cleanly in SQL.
   */
  async priceForMany(
    productIds: string[],
    mandiId?: string,
  ): Promise<Map<string, PlatformPrice>> {
    const result = new Map<string, PlatformPrice>();
    if (productIds.length === 0) return result;

    const where: Record<string, unknown> = {
      productId: In(productIds),
      status: ListingStatus.ACTIVE,
    };
    // Q9: the anchor should be computed within the retailer's own mandi.
    // RetailerProfile has no mandi yet, so callers pass one only when they
    // have it (e.g. wholesaler-side views); otherwise this is platform-wide.
    if (mandiId) where.mandiId = mandiId;

    const [listings, markupRows] = await Promise.all([
      this.listings.find({ where }),
      this.markups.find({ where: { productId: In(productIds) } }),
    ]);

    const markupByProduct = new Map(markupRows.map((m) => [m.productId, m]));
    const byProduct = new Map<string, WholesalerListing[]>();
    for (const l of listings) {
      const arr = byProduct.get(l.productId) ?? [];
      arr.push(l);
      byProduct.set(l.productId, arr);
    }

    for (const productId of productIds) {
      result.set(
        productId,
        this.computePrice(
          productId,
          byProduct.get(productId) ?? [],
          markupByProduct.get(productId),
        ),
      );
    }
    return result;
  }

  /**
   * Cheapest in-stock wholesaler that can actually serve `quantity`.
   *
   * MOQ is a hard filter, never absorbed by the platform: a wholesaler whose
   * minimum exceeds the order is ineligible rather than being met by sourcing
   * costlier stock. Returns null when nothing qualifies.
   */
  async sourceFor(
    productId: string,
    quantity: number,
    mandiId?: string,
  ): Promise<SourcingQuote | null> {
    const where: Record<string, unknown> = {
      productId,
      status: ListingStatus.ACTIVE,
    };
    if (mandiId) where.mandiId = mandiId;

    const eligible = (await this.listings.find({ where }))
      .filter((l) => l.stockUnits >= quantity && l.moq <= quantity)
      .sort((a, b) => Number(a.pricePerUnit) - Number(b.pricePerUnit));

    const best = eligible[0];
    if (!best) return null;

    return {
      listingId: best.id,
      wholesalerProfileId: best.wholesalerProfileId,
      mandiId: best.mandiId,
      costPerUnit: Number(best.pricePerUnit),
      moq: best.moq,
      stockUnits: best.stockUnits,
    };
  }

  markupPercentFor(markup?: ProductMarkup | null): number {
    return markup ? Number(markup.percent) : DEFAULT_MARKUP_PERCENT;
  }

  /** Upsert the markup for a product. Super admin only. */
  async setMarkup(
    productId: string,
    dto: { percent: number; moqOverride?: number | null },
    setByUserId: string,
  ) {
    const existing = await this.markups.findOne({ where: { productId } });
    const row = existing ?? this.markups.create({ productId });

    row.percent = dto.percent.toFixed(2);
    row.moqOverride = dto.moqOverride ?? null;
    row.setBySuperAdminId = setByUserId;

    await this.markups.save(row);
    return this.quoteBreakdownFor(productId);
  }

  sellingPriceFrom(costPerUnit: number, percent: number): number {
    return round2(costPerUnit * (1 + percent / 100));
  }

  /**
   * Super-admin-only view: every quote, the spread, and the margin. This is
   * the one place cost and margin are exposed — see the visibility matrix in
   * PRD §2.2.
   */
  async quoteBreakdownFor(productId: string) {
    const [listings, markup] = await Promise.all([
      this.listings.find({
        where: { productId, status: ListingStatus.ACTIVE },
        relations: { wholesaler: true, mandi: true },
      }),
      this.markups.findOne({ where: { productId } }),
    ]);

    const price = this.computePrice(productId, listings, markup);
    const percent = this.markupPercentFor(markup);
    const sourcingCost = inStockMinimum(listings);

    return {
      productId,
      markupPercent: percent,
      moqOverride: markup?.moqOverride ?? null,
      sourcingCost,
      sellingPrice: price.sellingPrice,
      mandiAverage: price.mandiAverage,
      marginPerUnit:
        price.sellingPrice != null && sourcingCost != null
          ? round2(price.sellingPrice - sourcingCost)
          : null,
      quotes: listings
        .sort((a, b) => Number(a.pricePerUnit) - Number(b.pricePerUnit))
        .map((l) => ({
          listingId: l.id,
          wholesalerName: l.wholesaler?.shopName ?? 'Wholesaler',
          mandiName: l.mandi?.name ?? null,
          pricePerUnit: Number(l.pricePerUnit),
          stockUnits: l.stockUnits,
          moq: l.moq,
          isSourcingQuote:
            l.stockUnits > 0 && Number(l.pricePerUnit) === sourcingCost,
        })),
    };
  }

  private computePrice(
    productId: string,
    listings: WholesalerListing[],
    markup?: ProductMarkup | null,
  ): PlatformPrice {
    const sourcing = listings
      .filter((l) => l.stockUnits > 0)
      .sort((a, b) => Number(a.pricePerUnit) - Number(b.pricePerUnit))[0];

    if (!sourcing) return unavailable(productId);

    const cost = Number(sourcing.pricePerUnit);
    const sellingPrice = this.sellingPriceFrom(
      cost,
      this.markupPercentFor(markup),
    );

    // The averaging rule: the anchor is the sourcing quote plus every quote
    // priced above it, in stock or not. Quotes *below* it are excluded —
    // those are cheaper listings that happen to be out of stock, and letting
    // them drag the average down would understate the saving. With nothing
    // above it the average collapses to the price itself and the saving is 0.
    const pool = listings
      .map((l) => Number(l.pricePerUnit))
      .filter((p) => p >= cost);
    const mandiAverage = round2(
      pool.reduce((sum, p) => sum + p, 0) / pool.length,
    );

    // Clamped: when the markup exceeds the min-to-average spread the raw
    // figure is negative — the retailer would be paying above the mandi
    // average. Open question O2 in the PRD; the clamp hides the number but
    // does not change the underlying pricing.
    const savingsVsAverage = Math.max(0, round2(mandiAverage - sellingPrice));

    const availableUnits = listings.reduce((sum, l) => sum + l.stockUnits, 0);

    return {
      productId,
      available: true,
      sellingPrice,
      mandiAverage,
      savingsVsAverage,
      effectiveMoq: markup?.moqOverride ?? sourcing.moq,
      stockStatus: stockStatusFor(sourcing.stockUnits),
      availableUnits,
    };
  }
}

function inStockMinimum(listings: WholesalerListing[]): number | null {
  const prices = listings
    .filter((l) => l.stockUnits > 0)
    .map((l) => Number(l.pricePerUnit));
  return prices.length ? Math.min(...prices) : null;
}

function unavailable(productId: string): PlatformPrice {
  return {
    productId,
    available: false,
    sellingPrice: null,
    mandiAverage: null,
    savingsVsAverage: null,
    effectiveMoq: 1,
    stockStatus: StockStatus.OUT,
    availableUnits: 0,
  };
}
