import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Mandi } from '../mandis/mandi.entity';

@Entity('wholesaler_profiles')
export class WholesalerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.wholesalerProfile)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Mandi, { eager: true })
  mandi: Mandi;

  @Column()
  mandiId: string;

  @Column({ nullable: true })
  shopName?: string;

  /**
   * Plain-text pickup address — a rider needs somewhere to collect an order
   * from. See PLAN-order-delivery.md §1 for why this is free text for now.
   */
  @Column({ nullable: true })
  address?: string;

  @CreateDateColumn()
  createdAt: Date;
}
