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

export enum DeliveryPartnerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/**
 * A rider on the platform-owned delivery fleet (see PLAN-order-delivery.md
 * §1, §8). Manually seeded and mandi-scoped, same shortcut already taken
 * for Mandi Admins — no self-signup/invite flow yet (TODO.md).
 */
@Entity('delivery_partner_profiles')
export class DeliveryPartnerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.deliveryPartnerProfile)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column()
  name: string;

  /** e.g. "Bike · DL01AB1234" — free text, purely informational. */
  @Column({ nullable: true })
  vehicleInfo?: string;

  @ManyToOne(() => Mandi, { eager: true })
  mandi: Mandi;

  @Column()
  mandiId: string;

  @Column({
    type: 'enum',
    enum: DeliveryPartnerStatus,
    default: DeliveryPartnerStatus.ACTIVE,
  })
  status: DeliveryPartnerStatus;

  @CreateDateColumn()
  createdAt: Date;
}
