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
import { WholesalerListing } from '../listings/wholesaler-listing.entity';

/**
 * Deliberately does NOT snapshot price/MOQ/stock — the cart always reads
 * live off `WholesalerListing` so it reflects reality up to the moment of
 * checkout. Checkout is where a frozen copy gets taken (onto OrderItem).
 */
@Entity('cart_items')
@Unique('uq_cart_item_listing', ['cartId', 'wholesalerListingId'])
@Index(['cartId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cart, { onDelete: 'CASCADE' })
  cart: Cart;

  @Column()
  cartId: string;

  @ManyToOne(() => WholesalerListing, { onDelete: 'CASCADE' })
  wholesalerListing: WholesalerListing;

  @Column({ type: 'uuid' })
  wholesalerListingId: string;

  @Column({ type: 'int' })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
