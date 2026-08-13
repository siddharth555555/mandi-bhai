import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RetailerProfile } from '../entities/retailer-profile.entity';

/**
 * One open cart per retailer. There's no concept of a "past cart" — once
 * checkout succeeds, its items are cleared and the same row is reused next
 * time (see PLAN-order-delivery.md §2).
 */
@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => RetailerProfile)
  @JoinColumn()
  retailerProfile: RetailerProfile;

  @Column({ unique: true })
  retailerProfileId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
