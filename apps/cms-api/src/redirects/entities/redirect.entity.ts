import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('redirects')
@Index(['siteId', 'fromPath'], { unique: true })
export class Redirect {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  siteId: string;

  @Column()
  fromPath: string;

  @Column()
  toPath: string;

  @Column({ default: 301 })
  statusCode: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
