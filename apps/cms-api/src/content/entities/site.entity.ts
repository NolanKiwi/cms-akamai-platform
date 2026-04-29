import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export interface SiteTheme {
  primary?: string;
  accent?: string;
  background?: string;
  foreground?: string;
  radius?: string;
}

export interface SiteBranding {
  logoUrl?: string;
  faviconUrl?: string;
  tagline?: string;
}

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 64 })
  slug: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column('text', { array: true, default: ['en'] })
  locales: string[];

  @Column({ name: 'default_locale', length: 8, default: 'en' })
  defaultLocale: string;

  @Column({ nullable: true, length: 255 })
  hostname: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  theme: SiteTheme | null;

  @Column({ type: 'jsonb', nullable: true })
  branding: SiteBranding | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
