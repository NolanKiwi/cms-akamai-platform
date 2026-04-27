import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('media_assets')
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'site_id' }) siteId: string;
  @Column({ length: 512 }) filename: string;
  @Column({ name: 'original_key', length: 1024 }) originalKey: string;
  @Column({ name: 'cdn_url', nullable: true, length: 1024 }) cdnUrl: string;
  @Column({ name: 'mime_type', nullable: true, length: 128 }) mimeType: string;
  @Column({ name: 'file_size', nullable: true, type: 'bigint' }) fileSize: number;
  @Column({ nullable: true }) width: number;
  @Column({ nullable: true }) height: number;
  @Column({ name: 'alt_text', nullable: true, length: 512 }) altText: string;
  @Column({ name: 'focal_point_x', nullable: true, type: 'float' }) focalPointX: number;
  @Column({ name: 'focal_point_y', nullable: true, type: 'float' }) focalPointY: number;
  @Column({ type: 'jsonb', nullable: true }) metadata: any;
  @Column('text', { array: true, default: [] }) tags: string[];
  @Column({ name: 'uploaded_by', nullable: true }) uploadedBy: string;
  @Column({ name: 'malware_scanned', default: false }) malwareScanned: boolean;
  @Column({ name: 'malware_clean', nullable: true }) malwareClean: boolean;
  @CreateDateColumn({ name: 'uploaded_at' }) uploadedAt: Date;
}
