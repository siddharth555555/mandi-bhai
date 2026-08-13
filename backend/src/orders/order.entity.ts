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
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { Mandi } from '../mandis/mandi.entity';

export enum OrderStatus {
  PLACED = 'placed',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  PACKED = 'packed',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  DELIVERY_FAILED = 'delivery_failed',
}

export enum PaymentMethod {
  COD = 'cod',
  UDHAAR = 'udhaar',
}

export enum OrderPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

/**
 * One wholesaler's slice of a retailer's checkout. A cart spanning 3
 * wholesalers produces 3 Orders — see PLAN-order-delivery.md §1 for why
 * checkout fans out rather than producing a single multi-seller order.
 */
@Entity('orders')
@Index(['retailerProfileId'])
@Index(['wholesalerProfileId'])
@Index(['mandiId'])
@Index(['status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-readable, e.g. MB-2026-K3F9QZ. Not used for lookups (id is). */
  @Column({ unique: true })
  orderNumber: string;

  @ManyToOne(() => RetailerProfile, { onDelete: 'RESTRICT' })
  retailerProfile: RetailerProfile;

  @Column()
  retailerProfileId: string;

  @ManyToOne(() => WholesalerProfile, { onDelete: 'RESTRICT' })
  wholesalerProfile: WholesalerProfile;

  @Column()
  wholesalerProfileId: string;

  @ManyToOne(() => Mandi)
  mandi: Mandi;

  @Column()
  mandiId: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PLACED })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: OrderPaymentStatus,
    default: OrderPaymentStatus.PENDING,
  })
  paymentStatus: OrderPaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string;

  @Column({ type: 'int' })
  itemCount: number;

  /**
   * Snapshot of the retailer's address at checkout time — deliberately NOT
   * a live join, so an order already in transit doesn't silently retarget
   * if the retailer edits their profile address later.
   */
  @Column()
  deliveryAddress: string;

  @CreateDateColumn()
  placedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  packedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date | null;

  @Column({ nullable: true })
  cancelReason?: string;

  @Column({ nullable: true })
  rejectReason?: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
