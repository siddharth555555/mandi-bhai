import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ListingStatus,
  WholesalerListing,
  stockStatusFor,
} from './wholesaler-listing.entity';
import { CreateListingDto, UpdateListingDto } from './dto/listing.dto';
import { Product, ProductStatus } from '../catalog/product.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { formatPack } from '../catalog/pack-unit';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(WholesalerListing)
    private readonly listings: Repository<WholesalerListing>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(WholesalerProfile)
    private readonly wholesalers: Repository<WholesalerProfile>,
  ) {}

  /**
   * The JWT carries the user id, not the wholesaler profile id, so every
   * wholesaler-scoped call resolves the profile first. This is also what
   * enforces ownership — a listing is only reachable through its own
   * wholesaler's profile.
   */
  private async requireWholesaler(userId: string): Promise<WholesalerProfile> {
    const profile = await this.wholesalers.findOne({ where: { userId } });
    if (!profile) {
      throw new ForbiddenException('No wholesaler profile on this account');
    }
    return profile;
  }

  async listMine(userId: string) {
    const wholesaler = await this.requireWholesaler(userId);

    const rows = await this.listings.find({
      where: { wholesalerProfileId: wholesaler.id },
      relations: { product: { category: true } },
      order: { createdAt: 'DESC' },
    });

    const stockValue = rows.reduce(
      (sum, r) => sum + Number(r.pricePerUnit) * r.stockUnits,
      0,
    );
    const lowOrOut = rows.filter(
      (r) => stockStatusFor(r.stockUnits) !== 'in_stock',
    ).length;

    return {
      summary: {
        listingCount: rows.length,
        stockValue: Math.round(stockValue * 100) / 100,
        lowOrOutCount: lowOrOut,
      },
      items: rows.map((r) => this.toListingView(r)),
    };
  }

  async create(userId: string, dto: CreateListingDto) {
    const wholesaler = await this.requireWholesaler(userId);

    const product = await this.products.findOne({
      where: { id: dto.productId },
      relations: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('That product is archived');
    }

    const existing = await this.listings.findOne({
      where: { productId: dto.productId, wholesalerProfileId: wholesaler.id },
    });
    if (existing) {
      throw new BadRequestException(
        'You already stock this product — edit the existing listing instead',
      );
    }

    this.assertPriceSaneAgainstMrp(dto.pricePerUnit, dto.mrp);

    const listing = await this.listings.save(
      this.listings.create({
        productId: dto.productId,
        wholesalerProfileId: wholesaler.id,
        mandiId: wholesaler.mandiId,
        pricePerUnit: dto.pricePerUnit.toFixed(2),
        mrp: dto.mrp?.toFixed(2) ?? null,
        stockUnits: dto.stockUnits,
        moq: dto.moq ?? 1,
      }),
    );

    listing.product = product;
    return this.toListingView(listing);
  }

  async update(userId: string, listingId: string, dto: UpdateListingDto) {
    const wholesaler = await this.requireWholesaler(userId);

    const listing = await this.listings.findOne({
      where: { id: listingId, wholesalerProfileId: wholesaler.id },
      relations: { product: { category: true } },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const nextPrice = dto.pricePerUnit ?? Number(listing.pricePerUnit);
    const nextMrp =
      dto.mrp ?? (listing.mrp != null ? Number(listing.mrp) : undefined);
    this.assertPriceSaneAgainstMrp(nextPrice, nextMrp);

    if (dto.pricePerUnit !== undefined) {
      listing.pricePerUnit = dto.pricePerUnit.toFixed(2);
    }
    if (dto.mrp !== undefined) listing.mrp = dto.mrp.toFixed(2);
    if (dto.stockUnits !== undefined) listing.stockUnits = dto.stockUnits;
    if (dto.moq !== undefined) listing.moq = dto.moq;
    if (dto.status !== undefined) listing.status = dto.status;

    await this.listings.save(listing);
    return this.toListingView(listing);
  }

  async remove(userId: string, listingId: string) {
    const wholesaler = await this.requireWholesaler(userId);

    const listing = await this.listings.findOne({
      where: { id: listingId, wholesalerProfileId: wholesaler.id },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    await this.listings.remove(listing);
    return { deleted: true };
  }

  private assertPriceSaneAgainstMrp(price: number, mrp?: number) {
    if (mrp != null && mrp < price) {
      throw new BadRequestException(
        'MRP cannot be lower than your selling price',
      );
    }
  }

  private toListingView(l: WholesalerListing) {
    const price = Number(l.pricePerUnit);
    const mrp = l.mrp != null ? Number(l.mrp) : null;
    const product = l.product;

    return {
      id: l.id,
      product: product
        ? {
            id: product.id,
            name: product.name,
            brand: product.brand ?? null,
            categoryName: product.category?.nameEn ?? null,
            packLabel: formatPack(Number(product.packValue), product.packUnit),
          }
        : null,
      pricePerUnit: price,
      mrp,
      savingsVsMrp: mrp != null ? Math.round((mrp - price) * 100) / 100 : null,
      stockUnits: l.stockUnits,
      stockStatus: stockStatusFor(l.stockUnits),
      moq: l.moq,
      status: l.status,
      isActive: l.status === ListingStatus.ACTIVE,
    };
  }
}
