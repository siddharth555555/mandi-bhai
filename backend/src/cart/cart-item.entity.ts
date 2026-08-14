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
 * chooses a supplier. Sourcing is decided later, at allocation time.
 *
 * `snapshotPrice`/`snapshotMoq`/`snapshotAt` are the price/MOQ the retailer
 * last explicitly saw and accepted (set on add, and re-synced by
 * `POST /cart/validate`). Reads (`GET /cart`) compare this snapshot against
 * a fresh `PricingService` call to detect drift — they never overwrite it
 * silently (PRD §9.2, S7).
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

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  snapshotPrice: string;

  @Column({ type: 'int' })
  snapshotMoq: number;

  @Column({ type: 'timestamp' })
  snapshotAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
