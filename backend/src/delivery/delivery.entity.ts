import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { Mandi } from '../mandis/mandi.entity';

export enum DeliveryStatus {
  UNASSIGNED = 'unassigned',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

/**
 * Its own table rather than fields on Order because delivery has a
 * different owner (Mandi Admin / rider) and a different lifecycle clock —
 * see PLAN-order-delivery.md §2. Created the moment a wholesaler marks an
 * order "packed".
 */
@Entity('deliveries')
@Index(['mandiId'])
@Index(['deliveryPartnerId'])
@Index(['status'])
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn()
  order: Order;

  @Column({ unique: true })
  orderId: string;

  @ManyToOne(() => DeliveryPartnerProfile, { nullable: true })
  deliveryPartner?: DeliveryPartnerProfile | null;

  @Column({ type: 'uuid', nullable: true })
  deliveryPartnerId?: string | null;

  @ManyToOne(() => Mandi)
  mandi: Mandi;

  @Column()
  mandiId: string;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.UNASSIGNED })
  status: DeliveryStatus;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  pickedUpAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  failedAt?: Date | null;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
