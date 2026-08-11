import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../catalog/product.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { Mandi } from '../mandis/mandi.entity';

export enum ListingStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** At or below this many units a listing is flagged "low stock". */
export const LOW_STOCK_THRESHOLD = 10;

export enum StockStatus {
  IN_STOCK = 'in_stock',
  LOW = 'low',
  OUT = 'out',
}

export function stockStatusFor(units: number): StockStatus {
  if (units <= 0) return StockStatus.OUT;
  if (units <= LOW_STOCK_THRESHOLD) return StockStatus.LOW;
  return StockStatus.IN_STOCK;
}

/**
 * One wholesaler's offer of a master product. Everything commercial lives
 * here — price, MRP, stock, minimum order — because two wholesalers selling
 * the same product compete on exactly these terms.
 *
 * `mandiId` is denormalised off the wholesaler so retailer-facing queries can
 * filter by mandi without joining through the profile.
 */
@Entity('wholesaler_listings')
@Unique('uq_listing_product_wholesaler', ['productId', 'wholesalerProfileId'])
@Index(['productId'])
@Index(['wholesalerProfileId'])
@Index(['mandiId'])
export class WholesalerListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  product: Product;

  @Column()
  productId: string;

  // The join column must be named explicitly: TypeORM would otherwise derive
  // "wholesalerId" from the property name and create a second, always-null
  // column alongside our "wholesalerProfileId".
  @ManyToOne(() => WholesalerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wholesalerProfileId' })
  wholesaler: WholesalerProfile;

  @Column({ type: 'uuid' })
  wholesalerProfileId: string;

  @ManyToOne(() => Mandi)
  mandi: Mandi;

  @Column()
  mandiId: string;

  /** What the retailer pays this wholesaler, per pack. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerUnit: string;

  /**
   * Optional — wholesalers sometimes disagree on a product's MRP, so it's
   * captured per listing rather than on the master product.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  mrp?: string | null;

  @Column({ type: 'int', default: 0 })
  stockUnits: number;

  /** Minimum order quantity, in packs. */
  @Column({ type: 'int', default: 1 })
  moq: number;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.ACTIVE })
  status: ListingStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
