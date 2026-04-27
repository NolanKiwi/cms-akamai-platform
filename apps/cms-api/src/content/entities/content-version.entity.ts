import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('content_versions')
@Index(['entryId', 'version'], { unique: true })
@Index(['entryId'])
export class ContentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entry_id' })
  entryId: string;

  @Column()
  version: number;

  @Column({ type: 'jsonb' })
  fields: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any>;

  @Column('text', { array: true, default: [] })
  cacheTags: string[];

  @Column({ name: 'published_by', nullable: true })
  publishedBy: string;

  @Column({ name: 'published_at', nullable: true })
  publishedAt: Date;

  @Column({ nullable: true })
  changeNote: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
