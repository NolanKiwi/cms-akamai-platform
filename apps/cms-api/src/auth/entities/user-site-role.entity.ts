import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { UserRole } from './user.entity';

@Entity('user_site_roles')
@Index(['userId', 'siteId'], { unique: false })
export class UserSiteRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;
}
