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

/**
 * Mandi Admin — manually seeded, scoped to exactly one mandi (see TODO.md:
 * no self-signup/invite flow yet).
 */
@Entity('mandi_admin_profiles')
export class MandiAdminProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.mandiAdminProfile)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Mandi, { eager: true })
  mandi: Mandi;

  @Column()
  mandiId: string;

  @CreateDateColumn()
  createdAt: Date;
}
