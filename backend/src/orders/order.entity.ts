import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RetailerProfile } from '../entities/retailer-profile.entity';

export enum OrderStatus {
  PLACED = 'placed',
  CANCELLED = 'cancelled',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
  DELIVERY_FAILED = 'delivery_failed',
}

export enum PaymentMethod {
  COD = 'cod',
  PREPAID = 'prepaid',
}

export enum OrderPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

/**
 * The retailer's single order with the platform — the "customer order" side
 * of the two-object model (PRD §9.1). It never carries a wholesaler:
 * sourcing happens later against internal PurchaseOrders, which don't exist
 * yet — they land with the allocation engine in the next plan.
 *
 * `mandiId` is deliberately absent: nothing in this plan determines which
 * mandi an order sources from (that's an allocation-time decision, and
 * `RetailerProfile` itself has no mandi field yet either — see
 * `pricing.service.ts`'s own note on this gap). Add it once sourcing or
 * cutoff batching actually needs it.
 *
 * `status` intentionally keeps `assigned/picked_up/delivered/delivery_failed`
 * because `DeliveryService`'s rider/admin actions (unchanged in this plan)
 * still write them — but drops `confirmed/rejected/packed`, the wholesaler
 * states nothing writes anymore now that a customer order has no wholesaler.
 */
@Entity('orders')
@Index(['retailerProfileId'])
@Index(['status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNumber: string;

  @ManyToOne(() => RetailerProfile, { onDelete: 'RESTRICT' })
  retailerProfile: RetailerProfile;

  @Column()
  retailerProfileId: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PLACED })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: OrderPaymentStatus, default: OrderPaymentStatus.PENDING })
  paymentStatus: OrderPaymentStatus;

  /** Platform selling total the retailer was charged — min quote + markup, summed. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string;

  @Column({ type: 'int' })
  itemCount: number;

  @Column()
  deliveryAddress: string;

  @CreateDateColumn()
  placedAt: Date;

  /** When checkout's two-point price re-validation passed and the order was created. */
  @Column({ type: 'timestamp', nullable: true })
  confirmedPriceAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
