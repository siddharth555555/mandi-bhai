import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { Product } from '../catalog/product.entity';
import { PricingService } from '../pricing/pricing.service';
import { CartPriceTokenService, PricedCartLine } from './cart-price-token.service';
import { formatPack } from '../catalog/pack-unit';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    @InjectRepository(RetailerProfile)
    private readonly retailers: Repository<RetailerProfile>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly pricing: PricingService,
    private readonly tokens: CartPriceTokenService,
  ) {}

  private async requireRetailer(userId: string): Promise<RetailerProfile> {
    const profile = await this.retailers.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No retailer profile on this account');
    return profile;
  }

  private async getOrCreateCart(retailerProfileId: string): Promise<Cart> {
    let cart = await this.carts.findOne({ where: { retailerProfileId } });
    if (!cart) cart = await this.carts.save(this.carts.create({ retailerProfileId }));
    return cart;
  }

  async getMyCart(userId: string) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);
    return this.buildView(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const product = await this.products.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const price = await this.pricing.priceFor(dto.productId);
    if (!price.available) {
      throw new BadRequestException(`"${product.name}" is currently unavailable`);
    }

    let item = await this.items.findOne({ where: { cartId: cart.id, productId: dto.productId } });
    const quantity = (item?.quantity ?? 0) + dto.quantity;

    if (item) {
      item.quantity = quantity;
    } else {
      item = this.items.create({ cartId: cart.id, productId: dto.productId, quantity });
    }
    // Adding (or re-adding to) a line always syncs to the live price — there
    // is nothing to confirm yet, the retailer is choosing this right now.
    item.snapshotPrice = price.sellingPrice!.toFixed(2);
    item.snapshotMoq = price.effectiveMoq;
    item.snapshotAt = new Date();
    await this.items.save(item);

    return this.buildView(cart);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const item = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    // Quantity alone never re-prices the line — only add-item and validate()
    // do, so a quantity bump can't silently mask a price change (S7).
    item.quantity = dto.quantity;
    await this.items.save(item);

    return this.buildView(cart);
  }

  async removeItem(userId: string, itemId: string) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const item = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.items.remove(item);
    return this.buildView(cart);
  }

  /**
   * The explicit re-validation gate (PRD §9.2). Re-prices every line and
   * SYNCS each item's snapshot to the current live figures — this is the
   * retailer "seeing and accepting" the new numbers. Only if every line then
   * clears both the availability/price gate and the MOQ gate is a
   * `confirmedPriceToken` issued; checkout demands and re-verifies it.
   */
  async validate(userId: string) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const rows = await this.items.find({ where: { cartId: cart.id } });
    if (rows.length === 0) {
      return { ...(await this.buildView(cart)), confirmedPriceToken: null as string | null };
    }

    const prices = await this.pricing.priceForMany(rows.map((r) => r.productId));
    const now = new Date();
    for (const row of rows) {
      const price = prices.get(row.productId);
      if (!price?.available) continue; // left unsynced — still flagged unavailable below
      row.snapshotPrice = price.sellingPrice!.toFixed(2);
      row.snapshotMoq = price.effectiveMoq;
      row.snapshotAt = now;
    }
    await this.items.save(rows);

    const view = await this.buildView(cart);
    if (!view.canCheckout) {
      return { ...view, confirmedPriceToken: null as string | null };
    }

    const lines: PricedCartLine[] = rows.map((r) => ({
      productId: r.productId,
      quantity: r.quantity,
      snapshotPrice: Number(r.snapshotPrice),
      snapshotMoq: r.snapshotMoq,
    }));
    const token = this.tokens.sign(this.tokens.hashLines(cart.id, lines));

    return { ...view, confirmedPriceToken: token };
  }

  private async buildView(cart: Cart) {
    const rows = await this.items.find({ where: { cartId: cart.id }, relations: { product: true } });

    if (rows.length === 0) {
      return { id: cart.id, itemCount: 0, canCheckout: false, subtotal: 0, items: [] as any[] };
    }

    const prices = await this.pricing.priceForMany(rows.map((r) => r.productId));

    const items = rows.map((row) => {
      const product = row.product;
      const live = prices.get(row.productId);
      const unavailable = !live?.available;
      const livePricePerUnit = live?.sellingPrice ?? null;
      const liveMoq = live?.effectiveMoq ?? row.snapshotMoq;
      const priceChanged = !unavailable && livePricePerUnit !== Number(row.snapshotPrice);
      const moqChanged = !unavailable && liveMoq !== row.snapshotMoq;
      const belowMoq = !unavailable && row.quantity < liveMoq;

      return {
        id: row.id,
        productId: row.productId,
        quantity: row.quantity,
        product: product
          ? {
              id: product.id,
              name: product.name,
              brand: product.brand ?? null,
              packLabel: formatPack(Number(product.packValue), product.packUnit),
            }
          : null,
        pricePerUnit: Number(row.snapshotPrice),
        livePricePerUnit,
        lineTotal: Math.round(Number(row.snapshotPrice) * row.quantity * 100) / 100,
        moq: row.snapshotMoq,
        liveMoq,
        priceChanged,
        moqChanged,
        belowMoq,
        unavailable,
        isValid: !unavailable && !priceChanged && !moqChanged && !belowMoq,
      };
    });

    return {
      id: cart.id,
      itemCount: items.length,
      canCheckout: items.length > 0 && items.every((i) => i.isValid),
      subtotal: Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100,
      items,
    };
  }
}
