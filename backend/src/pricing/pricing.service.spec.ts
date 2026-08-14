import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PricingService } from './pricing.service';
import { ProductMarkup } from './product-markup.entity';
import {
  ListingStatus,
  StockStatus,
  WholesalerListing,
} from '../listings/wholesaler-listing.entity';

const PRODUCT = 'p1';

/** Minimal listing stub — only the fields the pricing maths reads. */
function listing(
  pricePerUnit: number,
  stockUnits: number,
  moq = 1,
): WholesalerListing {
  return {
    id: `l-${pricePerUnit}`,
    productId: PRODUCT,
    wholesalerProfileId: `w-${pricePerUnit}`,
    mandiId: 'm1',
    pricePerUnit: pricePerUnit.toFixed(2),
    stockUnits,
    moq,
    status: ListingStatus.ACTIVE,
  } as WholesalerListing;
}

describe('PricingService', () => {
  let service: PricingService;
  let listings: WholesalerListing[];
  let markup: ProductMarkup | null;

  beforeEach(async () => {
    listings = [];
    markup = null;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PricingService,
        {
          provide: getRepositoryToken(WholesalerListing),
          useValue: { find: async () => listings },
        },
        {
          provide: getRepositoryToken(ProductMarkup),
          useValue: {
            find: async () => (markup ? [markup] : []),
            findOne: async () => markup,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PricingService);
  });

  const withMarkup = (percent: number, moqOverride?: number) => {
    markup = {
      productId: PRODUCT,
      percent: percent.toFixed(2),
      moqOverride: moqOverride ?? null,
    } as ProductMarkup;
  };

  describe('mandi average', () => {
    it('averages the in-stock minimum and every quote above it', async () => {
      // The worked example from BRD §4.2: {38 in stock, 42, 48, 56 out of stock}
      listings = [listing(38, 400), listing(42, 150), listing(48, 900), listing(56, 0)];
      withMarkup(10);

      const price = await service.priceFor(PRODUCT);

      expect(price.mandiAverage).toBe(46); // (38+42+48+56)/4
      expect(price.sellingPrice).toBe(41.8); // 38 * 1.10
      expect(price.savingsVsAverage).toBe(4.2);
    });

    it('excludes cheaper out-of-stock quotes from the average', async () => {
      // The ₹30 listing is cheaper but unbuyable: it must neither become the
      // sourcing quote nor drag the anchor down.
      listings = [listing(30, 0), listing(40, 100), listing(60, 50)];
      withMarkup(10);

      const price = await service.priceFor(PRODUCT);

      expect(price.mandiAverage).toBe(50); // (40+60)/2 — the 30 is excluded
      expect(price.sellingPrice).toBe(44); // sourced at 40, not 30
    });

    it('collapses the average to the price when nothing is quoted above', async () => {
      listings = [listing(38, 400)];
      withMarkup(10);

      const price = await service.priceFor(PRODUCT);

      expect(price.mandiAverage).toBe(38);
      expect(price.savingsVsAverage).toBe(0);
    });
  });

  describe('savings clamp (PRD open question O2)', () => {
    it('reports zero rather than a negative saving on a tight spread', async () => {
      // Markup (10%) exceeds the min-to-average spread, so the retailer is
      // genuinely paying ₹41.80 against a ₹38.50 average. The clamp keeps the
      // displayed figure at 0; it does not make the pricing favourable.
      listings = [listing(38, 100), listing(39, 100)];
      withMarkup(10);

      const price = await service.priceFor(PRODUCT);

      expect(price.mandiAverage).toBe(38.5);
      expect(price.sellingPrice).toBe(41.8);
      expect(price.savingsVsAverage).toBe(0);
    });
  });

  describe('effective MOQ', () => {
    it("uses the cheapest in-stock wholesaler's MOQ", async () => {
      listings = [listing(38, 400, 10), listing(42, 150, 5)];
      withMarkup(10);

      expect((await service.priceFor(PRODUCT)).effectiveMoq).toBe(10);
    });

    it('prefers the super admin override when set', async () => {
      listings = [listing(38, 400, 10)];
      withMarkup(10, 3);

      expect((await service.priceFor(PRODUCT)).effectiveMoq).toBe(3);
    });
  });

  describe('availability', () => {
    it('reports unavailable when every quote is out of stock', async () => {
      listings = [listing(38, 0), listing(42, 0)];

      const price = await service.priceFor(PRODUCT);

      expect(price.available).toBe(false);
      expect(price.sellingPrice).toBeNull();
      expect(price.stockStatus).toBe(StockStatus.OUT);
    });
  });

  describe('sourceFor', () => {
    it('picks the cheapest wholesaler that can serve the quantity', async () => {
      listings = [listing(38, 400, 10), listing(42, 150, 5)];

      const quote = await service.sourceFor(PRODUCT, 20);

      expect(quote?.costPerUnit).toBe(38);
    });

    it('treats MOQ as a hard filter, never absorbing the gap', async () => {
      // Cheapest wholesaler needs 25; the order is for 8. It is ineligible
      // rather than being met by the platform sourcing costlier stock.
      listings = [listing(38, 400, 25), listing(42, 150, 5)];

      const quote = await service.sourceFor(PRODUCT, 8);

      expect(quote?.costPerUnit).toBe(42);
    });

    it('returns null when no wholesaler has enough stock', async () => {
      listings = [listing(38, 5, 1)];

      expect(await service.sourceFor(PRODUCT, 100)).toBeNull();
    });
  });
});
