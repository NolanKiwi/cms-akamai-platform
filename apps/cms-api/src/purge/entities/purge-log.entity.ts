import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum PurgeStatus {
  SUBMITTED = 'submitted',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

export enum PurgeTriggerType {
  PUBLISH = 'publish',
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  EMERGENCY = 'emergency',
}

@Entity('purge_log')
@Index(['submittedAt'])
export class PurgeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'akamai_purge_id', nullable: true })
  akamaiPurgeId: string;

  @Column({ name: 'trigger_type', type: 'enum', enum: PurgeTriggerType })
  triggerType: PurgeTriggerType;

  @Column({ name: 'trigger_entity', nullable: true })
  triggerEntity: string;

  @Column({ length: 16, default: 'tag' })
  scope: string;

  @Column('text', { array: true, default: [] })
  objects: string[];

  @Column({ type: 'enum', enum: PurgeStatus, default: PurgeStatus.SUBMITTED })
  status: PurgeStatus;

  @Column({ name: 'latency_ms', nullable: true })
  latencyMs: number;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ name: 'initiated_by', nullable: true })
  initiatedBy: string;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;
}
