import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';

export enum ContentStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('content_entries')
@Index(['siteId', 'contentType', 'slug', 'locale'], { unique: true })
@Index(['siteId', 'status'])
@Index(['scheduledAt', 'status'])
export class ContentEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column({ name: 'content_type', length: 64 })
  contentType: string;

  @Column({ length: 512 })
  slug: string;

  @Column({ length: 8, default: 'en' })
  locale: string;

  @Column({ type: 'enum', enum: ContentStatus, default: ContentStatus.DRAFT })
  status: ContentStatus;

  @Column({ default: 1 })
  version: number;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
