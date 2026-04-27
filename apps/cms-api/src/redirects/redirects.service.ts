import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redirect } from './entities/redirect.entity';

@Injectable()
export class RedirectsService {
  constructor(
    @InjectRepository(Redirect) private repo: Repository<Redirect>,
  ) {}

  async create(siteId: string, fromPath: string, toPath: string, statusCode = 301) {
    const existing = await this.repo.findOne({ where: { siteId, fromPath } });
    if (existing) throw new ConflictException(`Redirect already exists for path: ${fromPath}`);
    const redirect = this.repo.create({ siteId, fromPath, toPath, statusCode });
    return this.repo.save(redirect);
  }

  async update(id: string, data: Partial<{ toPath: string; statusCode: number; isActive: boolean }>) {
    const redirect = await this.repo.findOne({ where: { id } });
    if (!redirect) throw new NotFoundException('Redirect not found');
    Object.assign(redirect, data);
    return this.repo.save(redirect);
  }

  async delete(id: string) {
    const redirect = await this.repo.findOne({ where: { id } });
    if (!redirect) throw new NotFoundException('Redirect not found');
    await this.repo.remove(redirect);
    return { deleted: true };
  }

  async findBySite(siteId: string, page = 1, size = 50) {
    const [items, total] = await this.repo.findAndCount({
      where: { siteId },
      skip: (page - 1) * size,
      take: size,
      order: { createdAt: 'DESC' },
    });
    return { total, page, size, items };
  }

  async resolve(siteId: string, path: string): Promise<Redirect | null> {
    return this.repo.findOne({ where: { siteId, fromPath: path, isActive: true } });
  }

  async bulkImport(siteId: string, rows: Array<{ from: string; to: string; status?: number }>) {
    const results = { created: 0, skipped: 0 };
    for (const row of rows) {
      const exists = await this.repo.findOne({ where: { siteId, fromPath: row.from } });
      if (exists) { results.skipped++; continue; }
      await this.repo.save(this.repo.create({
        siteId,
        fromPath: row.from,
        toPath: row.to,
        statusCode: row.status ?? 301,
      }));
      results.created++;
    }
    return results;
  }
}
