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

  @CreateDateColumn()
  createdAt: Date;
}
