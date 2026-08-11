import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Product taxonomy. Bilingual by design — the app is Hindi-first for a lot of
 * its users, and category rails show both names.
 */
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  nameEn: string;

  @Column()
  nameHi: string;

  /** Material Symbols icon name, mirrors the prototype's category rail. */
  @Column({ nullable: true })
  icon?: string;

  /** Background tint used by the category chips. */
  @Column({ nullable: true })
  tint?: string;

  @Column({ nullable: true })
  iconColor?: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
