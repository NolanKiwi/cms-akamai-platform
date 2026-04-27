import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OnEvent } from '@nestjs/event-emitter';
import { PurgeLog, PurgeStatus, PurgeTriggerType } from './entities/purge-log.entity';
import { AkamaiPurgeClient } from './akamai-purge.client';
import { CacheTagService } from '../content/cache-tag.service';

export interface PurgeJobData {
  triggerType: PurgeTriggerType;
  triggerEntity?: string;
  scope: 'tag' | 'url';
  objects: string[];
  initiatedBy?: string;
}

@Injectable()
export class PurgeService {
  private readonly logger = new Logger('PurgeService');
  private readonly BATCH_SIZE = 1000;

  constructor(
    @InjectRepository(PurgeLog) private purgeLogRepo: Repository<PurgeLog>,
    @InjectQueue('purge') private purgeQueue: Queue,
    private akamaiClient: AkamaiPurgeClient,
    private cacheTagService: CacheTagService,
  ) {}

  @OnEvent('content.published')
  async onContentPublished(event: any) {
    const { entry, version } = event;
    const tags = this.cacheTagService.buildDependencyGraph(version.cacheTags || []);

    await this.enqueuePurge({
      triggerType: PurgeTriggerType.PUBLISH,
      triggerEntity: entry.id,
      scope: 'tag',
      objects: tags,
      initiatedBy: event.userId,
    });
  }

  @OnEvent('content.unpublished')
  async onContentUnpublished(event: any) {
    const { entry, version } = event;
    await this.enqueuePurge({
      triggerType: PurgeTriggerType.PUBLISH,
      triggerEntity: entry.id,
      scope: 'tag',
      objects: version?.cacheTags || [`${entry.contentType}:${entry.id}`],
      initiatedBy: event.userId,
    });
  }

  async enqueuePurge(data: PurgeJobData): Promise<string> {
    const log = this.purgeLogRepo.create({
      triggerType: data.triggerType,
      triggerEntity: data.triggerEntity,
      scope: data.scope,
      objects: data.objects,
      status: PurgeStatus.SUBMITTED,
      initiatedBy: data.initiatedBy,
    });
    const saved = await this.purgeLogRepo.save(log);

    await this.purgeQueue.add('execute-purge', {
      ...data,
      purgeLogId: saved.id,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return saved.id;
  }

  async executePurge(data: PurgeJobData & { purgeLogId: string }): Promise<void> {
    const { purgeLogId, scope, objects, triggerType, triggerEntity, initiatedBy } = data;
    const start = Date.now();
    const network = process.env.AKAMAI_NETWORK as 'production' | 'staging' || 'staging';

    try {
      await this.purgeLogRepo.update(purgeLogId, { status: PurgeStatus.IN_PROGRESS });

      // 1000개씩 배치 처리
      const batches = this.chunk(objects, this.BATCH_SIZE);
      const purgeIds: string[] = [];

      for (const batch of batches) {
        const result = await this.akamaiClient.invalidate({ scope, objects: batch, network });
        purgeIds.push(result.purgeId);
        this.logger.log(`Purge submitted: ${result.purgeId} (${batch.length} objects)`);
      }

      // 완료 대기 (최대 60초)
      const complete = await this.pollCompletion(purgeIds, 60000);
      const latencyMs = Date.now() - start;

      await this.purgeLogRepo.update(purgeLogId, {
        akamaiPurgeId: purgeIds[0],
        status: complete ? PurgeStatus.COMPLETE : PurgeStatus.TIMEOUT,
        latencyMs,
        completedAt: new Date(),
      });

      this.logger.log(`Purge ${complete ? 'complete' : 'timeout'}: ${purgeLogId} ${latencyMs}ms`);
    } catch (err) {
      await this.purgeLogRepo.update(purgeLogId, {
        status: PurgeStatus.FAILED,
        errorMessage: err.message,
        latencyMs: Date.now() - start,
        completedAt: new Date(),
      });
      throw err;
    }
  }

  async getPurgeStatus(id: string) {
    const log = await this.purgeLogRepo.findOne({ where: { id } });
    if (!log) return null;
    return {
      id: log.id,
      status: log.status,
      scope: log.scope,
      objectCount: log.objects.length,
      latencyMs: log.latencyMs,
      submittedAt: log.submittedAt,
      completedAt: log.completedAt,
      triggerType: log.triggerType,
    };
  }

  async getPurgeHistory(query: {
    page?: number;
    size?: number;
    triggerType?: string;
    status?: string;
    since?: Date;
  }) {
    const { page = 1, size = 50 } = query;
    const qb = this.purgeLogRepo.createQueryBuilder('p').orderBy('p.submittedAt', 'DESC');

    if (query.triggerType) qb.andWhere('p.triggerType = :t', { t: query.triggerType });
    if (query.status) qb.andWhere('p.status = :s', { s: query.status });
    if (query.since) qb.andWhere('p.submittedAt >= :since', { since: query.since });

    const [items, total] = await qb.skip((page - 1) * size).take(size).getManyAndCount();
    return { total, page, size, items };
  }

  private async pollCompletion(purgeIds: string[], timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const pending = new Set(purgeIds);

    while (pending.size > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      for (const id of [...pending]) {
        const status = await this.akamaiClient.getPurgeStatus(id);
        if (status === 'Done') pending.delete(id);
        else if (status === 'Failed') pending.delete(id);
      }
    }

    return pending.size === 0;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) },
      (_, i) => arr.slice(i * size, i * size + size));
  }
}
