import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RetailerProfile } from '../entities/retailer-profile.entity';

/**
 * One per retailer, created lazily on first Udhaar checkout attempt with
 * creditLimit 0 — an admin has to raise it before Udhaar is usable, a
 * deliberate soft gate (PLAN-order-delivery.md §5). The credit limit stays
 * a fixed manually-set value per TODO.md; the order-history-based
 * recommendation engine remains explicitly deferred.
 */
@Entity('udhaar_accounts')
export class UdhaarAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => RetailerProfile)
  @JoinColumn()
  retailerProfile: RetailerProfile;

  @Column({ unique: true })
  retailerProfileId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  creditLimit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  outstandingBalance: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
