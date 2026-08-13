import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UdhaarAccount } from './udhaar-account.entity';
import { Order } from '../orders/order.entity';

export enum UdhaarTransactionType {
  DRAW = 'draw',
  REPAYMENT = 'repayment',
  ADJUSTMENT = 'adjustment',
}

/**
 * A ledger, not just a running balance, so "why is my outstanding ₹4,200"
 * is always answerable — same audit-trail reasoning as SkuSubmission/KYC
 * review fields in PLAN-products-kyc.md.
 */
@Entity('udhaar_transactions')
@Index(['udhaarAccountId'])
export class UdhaarTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UdhaarAccount, { onDelete: 'CASCADE' })
  udhaarAccount: UdhaarAccount;

  @Column()
  udhaarAccountId: string;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  order?: Order | null;

  @Column({ type: 'uuid', nullable: true })
  orderId?: string | null;

  @Column({ type: 'enum', enum: UdhaarTransactionType })
  type: UdhaarTransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceAfter: string;

  @Column({ nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;
}
