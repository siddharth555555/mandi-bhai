import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('retailer_profiles')
export class RetailerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.retailerProfile)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true })
  shopName?: string;

  /**
   * Plain-text delivery address — added for the order/delivery module since
   * nothing previously captured where a rider should drop an order. No
   * structured street/city/pincode/geo fields yet (see PLAN-order-delivery.md).
   */
  @Column({ nullable: true })
  address?: string;

  @CreateDateColumn()
  createdAt: Date;
}
