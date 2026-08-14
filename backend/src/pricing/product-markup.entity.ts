import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../catalog/product.entity';

/** Applied when a product has no markup row of its own. */
export const DEFAULT_MARKUP_PERCENT = 10;

/**
 * The platform's revenue mechanism: a percentage added to the cheapest
 * available wholesaler quote to produce the retailer's selling price.
 *
 * Set by a super admin, per product. The super admin controls the markup and
 * an optional MOQ override — never the price itself, which always originates
 * from a wholesaler's quote.
 */
@Entity('product_markups')
@Unique('uq_markup_product', ['productId'])
@Index(['productId'])
export class ProductMarkup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  product: Product;

  @Column()
  productId: string;

  /** Percentage added to the sourcing quote, e.g. 10.00 for +10%. */
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percent: string;

  /**
   * Optional platform override of the wholesaler's MOQ. The wholesaler sets
   * the MOQ they can actually serve; the super admin can lower or raise what
   * the retailer sees when it is blocking demand.
   */
  @Column({ type: 'int', nullable: true })
  moqOverride?: number | null;

  @Column({ type: 'uuid', nullable: true })
  setBySuperAdminId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
