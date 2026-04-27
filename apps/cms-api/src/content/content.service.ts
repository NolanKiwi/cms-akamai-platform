import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContentEntry, ContentStatus } from './entities/content-entry.entity';
import { ContentVersion } from './entities/content-version.entity';
import { CacheTagService } from './cache-tag.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ListContentDto } from './dto/list-content.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentEntry) private entryRepo: Repository<ContentEntry>,
    @InjectRepository(ContentVersion) private versionRepo: Repository<ContentVersion>,
    private cacheTagService: CacheTagService,
    private eventEmitter: EventEmitter2,
    private auditService: AuditService,
  ) {}

  // ── 공개 API (캐시됨) ────────────────────────────────────

  async getBySlug(contentType: string, slug: string, locale = 'en', siteId?: string) {
    const where: FindOptionsWhere<ContentEntry> = {
      contentType, slug, locale, status: ContentStatus.PUBLISHED,
    };
    if (siteId) where.siteId = siteId;

    const entry = await this.entryRepo.findOne({ where });
    if (!entry) throw new NotFoundException(`${contentType}/${slug} 를 찾을 수 없습니다.`);

    return this.getPublishedVersion(entry);
  }

  // ── 어드민 API ────────────────────────────────────────────

  async list(contentType: string, siteId: string, opts: { locale?: string; status?: string; page?: number; size?: number }): Promise<any>;
  async list(contentType: string, dto: ListContentDto): Promise<any>;
  async list(contentType: string, siteIdOrDto: string | ListContentDto, opts: { locale?: string; status?: string; page?: number; size?: number } = {}): Promise<any> {
    if (typeof siteIdOrDto === 'string') {
      // Admin list — no status filter
      const { locale, status, page = 1, size = 50 } = opts;
      const where: any = { contentType, siteId: siteIdOrDto };
      if (locale) where.locale = locale;
      if (status) where.status = status;
      const [items, total] = await this.entryRepo.findAndCount({
        where,
        order: { updatedAt: 'DESC' },
        skip: (page - 1) * size,
        take: size,
      });
      return { total, page, size, items };
    }
    // Public list (original)
    const { siteId, locale = 'en', page = 1, size = 20, sort = 'published_desc' } = siteIdOrDto;
    const [items, total] = await this.entryRepo.findAndCount({
      where: { contentType, siteId, locale, status: ContentStatus.PUBLISHED },
      order: sort === 'published_desc' ? { publishedAt: 'DESC' } : { publishedAt: 'ASC' },
      skip: (page - 1) * size,
      take: size,
    });
    const results = await Promise.all(items.map(entry => this.getPublishedVersion(entry)));
    return { total, page, size, items: results.filter(Boolean) };
  }

  async create(contentType: string, dto: CreateContentDto, userId: string) {
    const existing = await this.entryRepo.findOne({
      where: { siteId: dto.siteId, contentType, slug: dto.slug || this.toSlug(dto.fields?.title), locale: dto.locale || 'en' },
    });
    if (existing) throw new ConflictException('같은 슬러그의 콘텐츠가 이미 존재합니다.');

    const slug = dto.slug || this.toSlug(dto.fields?.title || `${contentType}-${Date.now()}`);
    const entry = this.entryRepo.create({
      siteId: dto.siteId,
      contentType,
      slug,
      locale: dto.locale || 'en',
      status: ContentStatus.DRAFT,
      version: 1,
      createdBy: userId,
      updatedBy: userId,
    });
    await this.entryRepo.save(entry);

    const cacheTags = this.cacheTagService.generate(entry, dto.fields);
    const version = this.versionRepo.create({
      entryId: entry.id,
      version: 1,
      fields: dto.fields || {},
      meta: dto.meta,
      cacheTags,
    });
    await this.versionRepo.save(version);

    await this.auditService.log({
      userId, siteId: entry.siteId, entityType: 'content_entry',
      entityId: entry.id, action: 'create', after: entry,
    });

    return { ...entry, currentVersion: version };
  }

  async update(id: string, dto: UpdateContentDto, userId: string) {
    const entry = await this.getEntry(id);
    const prevVersion = await this.getCurrentDraftVersion(entry);

    // 새 버전 생성 (덮어쓰기 금지)
    const newVersionNum = (prevVersion?.version || entry.version) + 1;
    const fields = { ...(prevVersion?.fields || {}), ...dto.fields };
    const cacheTags = this.cacheTagService.generate(entry, fields);

    const newVersion = this.versionRepo.create({
      entryId: entry.id,
      version: newVersionNum,
      fields,
      meta: dto.meta || prevVersion?.meta,
      cacheTags,
    });
    await this.versionRepo.save(newVersion);

    await this.entryRepo.update(id, { version: newVersionNum, updatedBy: userId });

    await this.auditService.log({
      userId, siteId: entry.siteId, entityType: 'content_entry',
      entityId: id, action: 'update',
      before: prevVersion?.fields,
      after: fields,
    });

    return { ...entry, version: newVersionNum, currentVersion: newVersion };
  }

  async getAdmin(id: string, versionNum?: number) {
    const entry = await this.getEntry(id);
    const version = versionNum
      ? await this.versionRepo.findOne({ where: { entryId: id, version: versionNum } })
      : await this.getLatestVersion(id);
    return { ...entry, currentVersion: version };
  }

  async getVersionHistory(id: string) {
    await this.getEntry(id);
    return this.versionRepo.find({
      where: { entryId: id },
      order: { version: 'DESC' },
      select: ['id', 'version', 'publishedAt', 'publishedBy', 'changeNote', 'createdAt'],
    });
  }

  async submitForReview(id: string, userId: string) {
    const entry = await this.getEntry(id);
    this.assertStatus(entry, [ContentStatus.DRAFT]);
    await this.entryRepo.update(id, { status: ContentStatus.IN_REVIEW, updatedBy: userId });
    await this.auditService.log({
      userId, siteId: entry.siteId, entityType: 'content_entry',
      entityId: id, action: 'submit_review',
    });
    return { id, status: ContentStatus.IN_REVIEW };
  }

  async approve(id: string, userId: string) {
    const entry = await this.getEntry(id);
    this.assertStatus(entry, [ContentStatus.IN_REVIEW]);
    // 승인 = IN_REVIEW → DRAFT (즉시 발행은 publish() 로)
    await this.entryRepo.update(id, { status: ContentStatus.DRAFT, updatedBy: userId });
    await this.auditService.log({
      userId, siteId: entry.siteId, entityType: 'content_entry',
      entityId: id, action: 'approve',
    });
    return { id, status: ContentStatus.DRAFT, message: '승인 완료. publish()를 호출해 발행하세요.' };
  }

  async publish(id: string, userId: string) {
    const entry = await this.getEntry(id);
    this.assertStatus(entry, [ContentStatus.DRAFT, ContentStatus.IN_REVIEW, ContentStatus.SCHEDULED]);

    const latestVersion = await this.getLatestVersion(id);
    if (!latestVersion) throw new BadRequestException('발행할 콘텐츠 버전이 없습니다.');

    const now = new Date();
    await this.entryRepo.update(id, {
      status: ContentStatus.PUBLISHED,
      publishedAt: now,
      updatedBy: userId,
    });
    await this.versionRepo.update(latestVersion.id, {
      publishedBy: userId,
      publishedAt: now,
    });

    const updatedEntry = await this.getEntry(id);
    await this.auditService.log({
      userId, siteId: entry.siteId, entityType: 'content_entry',
      entityId: id, action: 'publish', after: { version: latestVersion.version },
    });

    this.eventEmitter.emit('content.published', {
      entry: updatedEntry,
      version: latestVersion,
      userId,
    });

    return { id, status: ContentStatus.PUBLISHED, cacheTags: latestVersion.cacheTags };
  }

  async schedule(id: string, scheduledAt: Date, userId: string) {
    const entry = await this.getEntry(id);
    this.assertStatus(entry, [ContentStatus.DRAFT, ContentStatus.IN_REVIEW]);

    if (new Date(scheduledAt) <= new Date()) {
      throw new BadRequestException('예약 시간은 현재 시간 이후여야 합니다.');
    }

    await this.entryRepo.update(id, {
      status: ContentStatus.SCHEDULED,
      scheduledAt,
      updatedBy: userId,
    });
    await this.auditService.log({
      userId, siteId: entry.siteId, entityType: 'content_entry',
      entityId: id, action: 'schedule', after: { scheduledAt },
    });

    return { id, status: ContentStatus.SCHEDULED, scheduledAt };
  }

  async rollback(id: string, toVersion: number, userId: string) {
    const entry = await this.getEntry(id);
    const targetVersion = await this.versionRepo.findOne({
      where: { entryId: id, version: toVersion },
    });
    if (!targetVersion) throw new NotFoundException(`버전 ${toVersion}을 찾을 수 없습니다.`);

    // 롤백 = 대상 버전 필드로 새 버전 생성
    const newVersionNum = entry.version + 1;
    const cacheTags = this.cacheTagService.generate(entry, targetVersion.fields);
    const newVersion = this.versionRepo.create({
      entryId: id,
      version: newVersionNum,
      fields: targetVersion.fields,
      meta: targetVersion.meta,
      cacheTags,
      changeNote: `버전 ${toVersion}으로 롤백`,
    });
    await this.versionRepo.save(newVersion);
    await this.entryRepo.update(id, { version: newVersionNum, updatedBy: userId });

    await this.auditService.log({
      userId, siteId: entry.siteId, entityType: 'content_entry',
      entityId: id, action: 'rollback',
      before: { version: entry.version },
      after: { toVersion, newVersion: newVersionNum },
    });

    return { id, rolledBackFrom: entry.version, newVersion: newVersionNum };
  }

  async archive(id: string, userId: string) {
    const entry = await this.getEntry(id);
    await this.entryRepo.update(id, { status: ContentStatus.ARCHIVED, updatedBy: userId });
    await this.auditService.log({
      userId, siteId: entry.siteId, entityType: 'content_entry',
      entityId: id, action: 'archive',
    });

    if (entry.status === ContentStatus.PUBLISHED) {
      const version = await this.getLatestVersion(id);
      this.eventEmitter.emit('content.unpublished', { entry, version, userId });
    }
    return { id, status: ContentStatus.ARCHIVED };
  }

  async runScheduledPublish() {
    const due = await this.entryRepo.find({
      where: { status: ContentStatus.SCHEDULED },
    });
    const now = new Date();
    const results: Array<{ id: string; status?: ContentStatus; cacheTags?: string[]; error?: string }> = [];
    for (const entry of due) {
      if (entry.scheduledAt && entry.scheduledAt <= now) {
        try {
          const result = await this.publish(entry.id, 'scheduler');
          results.push(result);
        } catch (err) {
          results.push({ id: entry.id, error: err.message });
        }
      }
    }
    return results;
  }

  // ── 유틸리티 ──────────────────────────────────────────────

  private async getEntry(id: string): Promise<ContentEntry> {
    const entry = await this.entryRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`콘텐츠 ID ${id}를 찾을 수 없습니다.`);
    return entry;
  }

  private async getPublishedVersion(entry: ContentEntry) {
    const version = await this.versionRepo.findOne({
      where: { entryId: entry.id, version: entry.version },
    });
    return version ? { ...entry, fields: version.fields, meta: version.meta, cacheTags: version.cacheTags } : null;
  }

  private async getCurrentDraftVersion(entry: ContentEntry): Promise<ContentVersion | null> {
    return this.versionRepo.findOne({
      where: { entryId: entry.id, version: entry.version },
      order: { version: 'DESC' },
    });
  }

  private async getLatestVersion(id: string): Promise<ContentVersion | null> {
    return this.versionRepo.findOne({
      where: { entryId: id },
      order: { version: 'DESC' },
    });
  }

  private assertStatus(entry: ContentEntry, allowed: ContentStatus[]) {
    if (!allowed.includes(entry.status)) {
      throw new BadRequestException(
        `현재 상태 '${entry.status}'에서는 이 작업을 수행할 수 없습니다. 허용 상태: ${allowed.join(', ')}`,
      );
    }
  }

  private toSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }
}
