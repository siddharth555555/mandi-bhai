import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order, PaymentMethod } from '../orders/order.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  COLLECTED = 'collected',
  FAILED = 'failed',
}

/**
 * Its own table (rather than columns on Order) so a future gateway-based
 * method slots in without an Order schema change — same swappable-driver
 * instinct as StorageService in PLAN-products-kyc.md. No online gateway
 * (Razorpay/Cashfree) is wired up directly — `method` is `cod | prepaid`,
 * with prepaid running through the stubbed `StubGatewayDriver` (see
 * `payment-gateway.driver.ts`); see NotificationService for the same
 * "stub now, swap later" pattern applied to notifications.
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn()
  order: Order;

  @Column({ unique: true })
  orderId: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'timestamp', nullable: true })
  collectedAt?: Date | null;

  @ManyToOne(() => DeliveryPartnerProfile, { nullable: true })
  collectedByDeliveryPartner?: DeliveryPartnerProfile | null;

  @Column({ type: 'uuid', nullable: true })
  collectedByDeliveryPartnerId?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
