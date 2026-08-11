import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RetailerProfile } from './retailer-profile.entity';
import { WholesalerProfile } from './wholesaler-profile.entity';
import { MandiAdminProfile } from './mandi-admin-profile.entity';

/**
 * A User is just an identity anchored to a phone number. All role-specific
 * data lives on profile tables (Retailer / Wholesaler / MandiAdmin) so a
 * single phone number can hold more than one role, per product decision.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @OneToOne(() => RetailerProfile, (p) => p.user, { nullable: true })
  retailerProfile?: RetailerProfile;

  @OneToOne(() => WholesalerProfile, (p) => p.user, { nullable: true })
  wholesalerProfile?: WholesalerProfile;

  @OneToOne(() => MandiAdminProfile, (p) => p.user, { nullable: true })
  mandiAdminProfile?: MandiAdminProfile;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
