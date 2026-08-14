import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from '../catalog/product.entity';

/**
 * References a master `Product`, not a wholesaler's listing: under the
 * managed-reseller model the retailer buys from the platform and never
 * chooses a supplier. Sourcing is decided at checkout.
 *
 * Deliberately does NOT snapshot price/MOQ — the cart re-prices live through
 * `PricingService` so it reflects reality up to the moment of checkout.
 * Checkout is where a frozen copy gets taken (onto OrderItem).
 */
@Entity('cart_items')
@Unique('uq_cart_item_product', ['cartId', 'productId'])
@Index(['cartId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cart, { onDelete: 'CASCADE' })
  cart: Cart;

  @Column()
  cartId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  product: Product;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
