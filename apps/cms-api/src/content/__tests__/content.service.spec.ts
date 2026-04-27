import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContentService } from '../content.service';
import { CacheTagService } from '../cache-tag.service';
import { ContentEntry, ContentStatus } from '../entities/content-entry.entity';
import { ContentVersion } from '../entities/content-version.entity';
import { AuditService } from '../../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockEntryRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockVersionRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockAuditService = () => ({ log: jest.fn() });
const mockEventEmitter = () => ({ emit: jest.fn() });

describe('ContentService', () => {
  let service: ContentService;
  let entryRepo: ReturnType<typeof mockEntryRepo>;
  let versionRepo: ReturnType<typeof mockVersionRepo>;
  let eventEmitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        CacheTagService,
        { provide: getRepositoryToken(ContentEntry), useFactory: mockEntryRepo },
        { provide: getRepositoryToken(ContentVersion), useFactory: mockVersionRepo },
        { provide: AuditService, useFactory: mockAuditService },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get(ContentService);
    entryRepo = module.get(getRepositoryToken(ContentEntry));
    versionRepo = module.get(getRepositoryToken(ContentVersion));
    eventEmitter = module.get(EventEmitter2);
  });

  describe('publish()', () => {
    const makeEntry = (status: ContentStatus) => ({
      id: 'e-1', siteId: 's-1', contentType: 'article',
      slug: 'test', locale: 'en', status, version: 1,
    });

    it('DRAFT 상태에서 발행 가능', async () => {
      const entry = makeEntry(ContentStatus.DRAFT);
      entryRepo.findOne.mockResolvedValue(entry);
      versionRepo.findOne.mockResolvedValue({ id: 'v-1', version: 1, cacheTags: ['article:e-1'] });
      entryRepo.update.mockResolvedValue({});
      versionRepo.update.mockResolvedValue({});

      const result = await service.publish('e-1', 'user-1');

      expect(result.status).toBe(ContentStatus.PUBLISHED);
      expect(eventEmitter.emit).toHaveBeenCalledWith('content.published', expect.any(Object));
    });

    it('ARCHIVED 상태에서 발행 불가', async () => {
      entryRepo.findOne.mockResolvedValue(makeEntry(ContentStatus.ARCHIVED));
      await expect(service.publish('e-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('존재하지 않는 ID → NotFoundException', async () => {
      entryRepo.findOne.mockResolvedValue(null);
      await expect(service.publish('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('rollback()', () => {
    it('유효한 버전으로 롤백 시 새 버전 생성', async () => {
      const entry = { id: 'e-1', siteId: 's-1', contentType: 'article', slug: 'test', locale: 'en', status: ContentStatus.PUBLISHED, version: 3 };
      const targetVersion = { id: 'v-1', version: 1, fields: { title: 'Old Title' }, meta: null };
      const newVersion = { id: 'v-new', version: 4 };

      entryRepo.findOne.mockResolvedValue(entry);
      versionRepo.findOne.mockResolvedValueOnce(targetVersion);
      versionRepo.create.mockReturnValue(newVersion);
      versionRepo.save.mockResolvedValue(newVersion);
      entryRepo.update.mockResolvedValue({});

      const result = await service.rollback('e-1', 1, 'user-1');
      expect(result.rolledBackFrom).toBe(3);
      expect(result.newVersion).toBe(4);
    });

    it('존재하지 않는 버전 → NotFoundException', async () => {
      entryRepo.findOne.mockResolvedValue({ id: 'e-1', version: 3 });
      versionRepo.findOne.mockResolvedValue(null);
      await expect(service.rollback('e-1', 99, 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('schedule()', () => {
    it('과거 시간 예약 불가', async () => {
      entryRepo.findOne.mockResolvedValue({ id: 'e-1', status: ContentStatus.DRAFT });
      const pastDate = new Date(Date.now() - 1000);
      await expect(service.schedule('e-1', pastDate, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('미래 시간 예약 가능', async () => {
      entryRepo.findOne.mockResolvedValue({ id: 'e-1', siteId: 's-1', status: ContentStatus.DRAFT });
      entryRepo.update.mockResolvedValue({});
      const futureDate = new Date(Date.now() + 60000);
      const result = await service.schedule('e-1', futureDate, 'user-1');
      expect(result.status).toBe(ContentStatus.SCHEDULED);
    });
  });
});
