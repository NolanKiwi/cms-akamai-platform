import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum VideoStatus { AWAITING = 'awaiting_upload', PROCESSING = 'processing', READY = 'ready', ERROR = 'error' }

@Entity('video_assets')
export class VideoAsset {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'site_id' }) siteId: string;
  @Column({ length: 512 }) title: string;
  @Column({ nullable: true, type: 'text' }) description: string;
  @Column({ name: 'hls_url', nullable: true, length: 1024 }) hlsUrl: string;
  @Column({ name: 'dash_url', nullable: true, length: 1024 }) dashUrl: string;
  @Column({ name: 'thumbnail_url', nullable: true, length: 1024 }) thumbnailUrl: string;
  @Column({ name: 'duration_ms', nullable: true }) durationMs: number;
  @Column({ name: 'geo_restriction', type: 'jsonb', nullable: true }) geoRestriction: any;
  @Column({ name: 'token_required', default: false }) tokenRequired: boolean;
  @Column({ type: 'enum', enum: VideoStatus, default: VideoStatus.AWAITING }) status: VideoStatus;
  @Column({ type: 'jsonb', nullable: true }) metadata: any;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
