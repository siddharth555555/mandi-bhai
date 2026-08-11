import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { ProductAlias } from './product-alias.entity';
import { PackBaseUnit, PackUnit } from './pack-unit';

export enum ProductStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

/**
 * A master catalogue entry — one row per real-world product, shared across
 * every mandi and every wholesaler.
 *
 * Deliberately contains NO price, MRP, or stock: those are commercial terms
 * that belong to an individual wholesaler's listing, not to the product
 * itself. Two wholesalers selling the same atta share this row and differ
 * only in their listings.
 */
@Entity('products')
@Index(['categoryId'])
@Index(['packBaseValue', 'packBaseUnit'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  brand?: string;

  @ManyToOne(() => Category, { eager: true })
  category: Category;

  @Column()
  categoryId: string;

  /** Pack size as entered, e.g. 5 + 'kg'. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  packValue: string;

  @Column({ type: 'enum', enum: PackUnit })
  packUnit: PackUnit;

  /**
   * Canonical measure derived from packValue/packUnit on save (5 kg -> 5000 g).
   * Stored rather than computed so it can be indexed and compared in SQL.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  packBaseValue: string;

  @Column({ type: 'enum', enum: PackBaseUnit })
  packBaseUnit: PackBaseUnit;

  @Column({ nullable: true })
  imagePath?: string;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status: ProductStatus;

  @OneToMany(() => ProductAlias, (a) => a.product)
  aliases: ProductAlias[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
