import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { WholesalerListing, ListingStatus } from '../listings/wholesaler-listing.entity';
import { formatPack } from '../catalog/pack-unit';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    @InjectRepository(RetailerProfile)
    private readonly retailers: Repository<RetailerProfile>,
    @InjectRepository(WholesalerListing)
    private readonly listings: Repository<WholesalerListing>,
  ) {}

  /** Same ownership-via-profile-lookup pattern as ListingsService. */
  private async requireRetailer(userId: string): Promise<RetailerProfile> {
    const profile = await this.retailers.findOne({ where: { userId } });
    if (!profile) {
      throw new ForbiddenException('No retailer profile on this account');
    }
    return profile;
  }

  private async getOrCreateCart(retailerProfileId: string): Promise<Cart> {
    let cart = await this.carts.findOne({ where: { retailerProfileId } });
    if (!cart) {
      cart = await this.carts.save(this.carts.create({ retailerProfileId }));
    }
    return cart;
  }

  async getMyCart(userId: string) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);
    return this.toCartView(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const listing = await this.listings.findOne({
      where: { id: dto.wholesalerListingId },
    });
    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException('Listing not found or no longer available');
    }

    let item = await this.items.findOne({
      where: { cartId: cart.id, wholesalerListingId: dto.wholesalerListingId },
    });

    if (item) {
      item.quantity += dto.quantity;
    } else {
      item = this.items.create({
        cartId: cart.id,
        wholesalerListingId: dto.wholesalerListingId,
        quantity: dto.quantity,
      });
    }
    await this.items.save(item);

    return this.toCartView(cart);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const item = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    item.quantity = dto.quantity;
    await this.items.save(item);

    return this.toCartView(cart);
  }

  async removeItem(userId: string, itemId: string) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const item = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.items.remove(item);
    return this.toCartView(cart);
  }

  private async toCartView(cart: Cart) {
    const rows = await this.items.find({
      where: { cartId: cart.id },
      relations: {
        wholesalerListing: { product: { category: true }, wholesaler: true },
      },
      order: { createdAt: 'ASC' },
    });

    const items = rows.map((row) => {
      const listing = row.wholesalerListing;
      const product = listing?.product;
      const price = listing ? Number(listing.pricePerUnit) : 0;
      const belowMoq = listing ? row.quantity < listing.moq : false;
      const overStock = listing ? row.quantity > listing.stockUnits : false;
      const unavailable = !listing || listing.status !== ListingStatus.ACTIVE;

      return {
        id: row.id,
        wholesalerListingId: row.wholesalerListingId,
        quantity: row.quantity,
        product: product
          ? {
              id: product.id,
              name: product.name,
              brand: product.brand ?? null,
              packLabel: formatPack(Number(product.packValue), product.packUnit),
            }
          : null,
        wholesalerName: listing?.wholesaler?.shopName ?? 'Wholesaler',
        wholesalerProfileId: listing?.wholesalerProfileId ?? null,
        pricePerUnit: price,
        lineTotal: Math.round(price * row.quantity * 100) / 100,
        moq: listing?.moq ?? 1,
        stockUnits: listing?.stockUnits ?? 0,
        belowMoq,
        overStock,
        unavailable,
        isValid: !unavailable && !belowMoq && !overStock,
      };
    });

    const groupsByWholesaler = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.wholesalerProfileId ?? 'unknown';
      const group = groupsByWholesaler.get(key) ?? [];
      group.push(item);
      groupsByWholesaler.set(key, group);
    }

    const wholesalerGroups = Array.from(groupsByWholesaler.entries()).map(
      ([wholesalerProfileId, groupItems]) => ({
        wholesalerProfileId,
        wholesalerName: groupItems[0]?.wholesalerName ?? 'Wholesaler',
        items: groupItems,
        subtotal:
          Math.round(groupItems.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100,
      }),
    );

    return {
      id: cart.id,
      itemCount: items.length,
      canCheckout: items.length > 0 && items.every((i) => i.isValid),
      subtotal: Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100,
      wholesalerGroups,
      items,
    };
  }
}
