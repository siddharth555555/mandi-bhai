import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../catalog/product.entity';

/**
 * Snapshots product name/pack/price at checkout — same "orders are
 * immutable receipts" reasoning used elsewhere. `pricePerUnit` is the
 * platform selling price the retailer approved via cart validation
 * (PRD §9.2) and is what was actually charged; it isn't split into a
 * separate "approved vs current" figure yet because nothing can raise it
 * post-placement until re-sourcing exists (next plan — see PRD
 * `OrderItem.approvedSellingPricePerUnit`).
 */
@Entity('order_items')
@Index(['orderId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  order: Order;

  @Column()
  orderId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  product: Product;

  @Column()
  productId: string;

  @Column()
  productNameSnapshot: string;

  @Column()
  packSizeSnapshot: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerUnit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lineTotal: string;

  @CreateDateColumn()
  createdAt: Date;
}
