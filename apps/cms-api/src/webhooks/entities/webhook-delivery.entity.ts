import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') webhookId: string;
  @Column() event: string;
  @Column('jsonb') payload: object;
  @Column({ nullable: true }) responseStatus: number;
  @Column({ nullable: true, type: 'text' }) responseBody: string;
  @Column({ default: false }) success: boolean;
  @Column({ default: 0 }) attempt: number;
  @CreateDateColumn() deliveredAt: Date;
}
