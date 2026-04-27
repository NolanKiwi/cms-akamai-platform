import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum WebhookEvent {
  CONTENT_PUBLISHED = 'content.published',
  CONTENT_UNPUBLISHED = 'content.unpublished',
  CONTENT_UPDATED = 'content.updated',
  ASSET_UPLOADED = 'asset.uploaded',
}

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') siteId: string;
  @Column() url: string;
  @Column('text', { array: true, default: '{}' }) events: WebhookEvent[];
  @Column({ select: false }) secret: string;
  @Column({ default: true }) isActive: boolean;
  @Column({ default: 0 }) failureCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
