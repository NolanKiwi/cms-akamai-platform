import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

interface LogParams {
  userId?: string;
  siteId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  before?: any;
  after?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

  async log(params: LogParams): Promise<void> {
    const entry = this.repo.create(params);
    await this.repo.save(entry).catch(() => {}); // 감사 로그 실패가 메인 흐름 차단 안 함
  }

  async query(filters: { userId?: string; entityType?: string; siteId?: string; page?: number; size?: number }) {
    const { page = 1, size = 50 } = filters;
    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    if (filters.userId) qb.andWhere('a.userId = :uid', { uid: filters.userId });
    if (filters.entityType) qb.andWhere('a.entityType = :et', { et: filters.entityType });
    if (filters.siteId) qb.andWhere('a.siteId = :sid', { sid: filters.siteId });
    const [items, total] = await qb.skip((page - 1) * size).take(size).getManyAndCount();
    return { total, page, size, items };
  }
}
