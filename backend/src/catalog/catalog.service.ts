import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { Product, ProductStatus } from './product.entity';
import { StockStatus } from '../listings/wholesaler-listing.entity';
import { PlatformPrice, PricingService } from '../pricing/pricing.service';
import {
  AliasLocale,
  AliasSource,
  ProductAlias,
  normaliseAlias,
} from './product-alias.entity';
import { PackUnit, formatPack, normalisePack } from './pack-unit';
import {
  CreateAliasDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/catalog.dto';

const DEFAULT_LIMIT = 20;

/**
 * The retailer-facing shape of a price. Deliberately narrow: the platform is
 * the seller, so no supplier identity, no seller count, and above all no raw
 * sourcing quote — that plus the selling price would reveal the markup
 * exactly. See the visibility matrix in PRD §2.2.
 */
function toRetailerOffer(price?: PlatformPrice) {
  if (!price || !price.available) {
    return {
      available: false,
      sellingPrice: null,
      mandiAverage: null,
      savingsVsAverage: null,
      moq: 1,
      stockStatus: StockStatus.OUT,
    };
  }
  return {
    available: true,
    sellingPrice: price.sellingPrice,
    mandiAverage: price.mandiAverage,
    savingsVsAverage: price.savingsVsAverage,
    moq: price.effectiveMoq,
    stockStatus: price.stockStatus,
  };
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductAlias)
    private readonly aliases: Repository<ProductAlias>,
    private readonly pricing: PricingService,
  ) {}

  listCategories() {
    return this.categories.find({ order: { sortOrder: 'ASC', nameEn: 'ASC' } });
  }

  /**
   * Alias-aware product search. A query matches if it appears in the product
   * name, the brand, or ANY of the product's aliases — which is what lets
   * "atta", "आटा" and "flour" all find the same row.
   */
  async searchProducts(query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .where('p.status = :status', { status: ProductStatus.ACTIVE });

    if (query.categoryId) {
      qb.andWhere('p.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.q?.trim()) {
      const needle = `%${normaliseAlias(query.q)}%`;
      qb.andWhere(
        `(
          LOWER(p.name) LIKE :needle
          OR LOWER(COALESCE(p.brand, '')) LIKE :needle
          OR EXISTS (
            SELECT 1 FROM product_aliases pa
            WHERE pa."productId" = p.id AND pa.normalised LIKE :needle
          )
        )`,
        { needle },
      );
    }

    const [rows, total] = await qb
      .orderBy('p.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Price this page in one batch rather than joining into the main query —
    // keeps the search SQL simple and avoids row explosion.
    const prices = await this.pricing.priceForMany(rows.map((p) => p.id));

    return {
      items: rows.map((p) => ({
        ...this.toProductView(p),
        offer: toRetailerOffer(prices.get(p.id)),
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProduct(id: string) {
    const product = await this.products.findOne({
      where: { id },
      relations: { category: true, aliases: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    return {
      ...this.toProductView(product),
      aliases: (product.aliases ?? []).map((a) => ({
        id: a.id,
        alias: a.alias,
        locale: a.locale,
        source: a.source,
      })),
      offer: toRetailerOffer(await this.pricing.priceFor(id)),
    };
  }

  async createProduct(dto: CreateProductDto) {
    const category = await this.categories.findOne({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const product = this.products.create({
      name: dto.name.trim(),
      brand: dto.brand?.trim(),
      categoryId: dto.categoryId,
      ...this.buildPackColumns(dto.packValue, dto.packUnit),
    });

    const saved = await this.products.save(product);
    return this.getProduct(saved.id);
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.categoryId) {
      const category = await this.categories.findOne({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');
      product.categoryId = dto.categoryId;
    }

    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.brand !== undefined) product.brand = dto.brand?.trim();
    if (dto.status !== undefined) product.status = dto.status;

    // Pack value and unit must move together — changing one without the other
    // would leave the derived base measure inconsistent.
    const changingPack =
      dto.packValue !== undefined || dto.packUnit !== undefined;
    if (changingPack) {
      const value = dto.packValue ?? Number(product.packValue);
      const unit = dto.packUnit ?? product.packUnit;
      Object.assign(product, this.buildPackColumns(value, unit));
    }

    await this.products.save(product);
    return this.getProduct(id);
  }

  async listAliases(productId: string) {
    await this.assertProductExists(productId);
    const rows = await this.aliases.find({
      where: { productId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((a) => ({
      id: a.id,
      alias: a.alias,
      locale: a.locale,
      source: a.source,
      createdAt: a.createdAt,
    }));
  }

  async addAlias(
    productId: string,
    dto: CreateAliasDto,
    source = AliasSource.ADMIN,
  ) {
    await this.assertProductExists(productId);

    const normalised = normaliseAlias(dto.alias);
    if (!normalised) throw new BadRequestException('Alias cannot be empty');

    const existing = await this.aliases.findOne({
      where: { productId, normalised },
    });
    if (existing) {
      throw new BadRequestException(
        'That alias already exists on this product',
      );
    }

    const alias = await this.aliases.save(
      this.aliases.create({
        productId,
        alias: dto.alias.trim(),
        normalised,
        locale: dto.locale ?? this.detectLocale(dto.alias),
        source,
      }),
    );

    return {
      id: alias.id,
      alias: alias.alias,
      locale: alias.locale,
      source: alias.source,
    };
  }

  async removeAlias(productId: string, aliasId: string) {
    const alias = await this.aliases.findOne({
      where: { id: aliasId, productId },
    });
    if (!alias) throw new NotFoundException('Alias not found on this product');
    await this.aliases.remove(alias);
    return { deleted: true };
  }

  private async assertProductExists(productId: string) {
    const exists = await this.products.findOne({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Product not found');
  }

  private buildPackColumns(value: number, unit: PackUnit) {
    const { baseValue, baseUnit } = normalisePack(value, unit);
    return {
      packValue: value.toFixed(2),
      packUnit: unit,
      packBaseValue: baseValue.toFixed(2),
      packBaseUnit: baseUnit,
    };
  }

  /** Devanagari block — good enough to tag Hindi aliases without asking. */
  private detectLocale(value: string): AliasLocale {
    return /[ऀ-ॿ]/.test(value) ? AliasLocale.HI : AliasLocale.EN;
  }

  private toProductView(p: Product) {
    const packValue = Number(p.packValue);
    return {
      id: p.id,
      name: p.name,
      brand: p.brand ?? null,
      category: p.category
        ? {
            id: p.category.id,
            slug: p.category.slug,
            nameEn: p.category.nameEn,
            nameHi: p.category.nameHi,
          }
        : null,
      pack: {
        value: packValue,
        unit: p.packUnit,
        label: formatPack(packValue, p.packUnit),
        baseValue: Number(p.packBaseValue),
        baseUnit: p.packBaseUnit,
      },
      imagePath: p.imagePath ?? null,
      status: p.status,
    };
  }
}
