import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany,
} from 'typeorm';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 64 })
  slug: string;

  @Column({ length: 255 })
  name: string;

  @Column('text', { array: true, default: ['en'] })
  locales: string[];

  @Column({ name: 'default_locale', length: 8, default: 'en' })
  defaultLocale: string;

  @Column({ nullable: true, length: 255 })
  hostname: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
