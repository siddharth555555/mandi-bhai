import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Super Admin — platform-wide, not mandi-scoped. Owns the master catalogue,
 * markup rates, MOQ overrides, and margin reporting.
 *
 * Margin is visible to this role and no other (see PRD §2.2). Manually
 * seeded only, same shortcut as Mandi Admin and rider.
 */
@Entity('super_admin_profiles')
export class SuperAdminProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.superAdminProfile)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;
}
