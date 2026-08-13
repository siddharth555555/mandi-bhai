import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { WholesalerListing } from '../listings/wholesaler-listing.entity';
import { Product } from '../catalog/product.entity';

/**
 * Snapshots product name/pack/price at the moment of checkout — same
 * "orders are immutable receipts" reasoning already applied to
 * SkuSubmission in PLAN-products-kyc.md. An order placed today still reads
 * correctly even if the listing is edited or removed later.
 */
@Entity('order_items')
@Index(['orderId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  order: Order;

  @Column()
  orderId: string;

  @ManyToOne(() => WholesalerListing, { onDelete: 'SET NULL', nullable: true })
  wholesalerListing?: WholesalerListing | null;

  @Column({ type: 'uuid', nullable: true })
  wholesalerListingId?: string | null;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  product?: Product | null;

  @Column({ type: 'uuid', nullable: true })
  productId?: string | null;

  @Column()
  productNameSnapshot: string;

  @Column()
  packSizeSnapshot: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerUnit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lineTotal: string;

  @CreateDateColumn()
  createdAt: Date;
}
