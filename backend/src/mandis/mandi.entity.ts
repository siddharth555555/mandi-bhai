import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A "mandi" is a local wholesale market/hub. Wholesalers and Mandi Admins
 * are both scoped to exactly one mandi; retailers are not (they can buy
 * from wholesalers across mandis serving their area).
 */
@Entity('mandis')
export class Mandi {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  city: string;

  @CreateDateColumn()
  createdAt: Date;
}
