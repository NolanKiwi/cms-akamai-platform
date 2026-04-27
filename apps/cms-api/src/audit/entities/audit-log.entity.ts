import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId', 'createdAt'])
@Index(['siteId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', nullable: true }) userId: string;
  @Column({ name: 'site_id', nullable: true }) siteId: string;
  @Column({ name: 'entity_type', length: 64 }) entityType: string;
  @Column({ name: 'entity_id', nullable: true }) entityId: string;
  @Column({ length: 64 }) action: string;
  @Column({ type: 'jsonb', nullable: true }) before: any;
  @Column({ type: 'jsonb', nullable: true }) after: any;
  @Column({ name: 'ip_address', nullable: true }) ipAddress: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
