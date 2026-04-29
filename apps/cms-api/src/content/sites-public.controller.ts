import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';
import { Site } from './entities/site.entity';

@ApiTags('Sites (Public)')
@Controller('sites')
export class SitesPublicController {
  constructor(@InjectRepository(Site) private repo: Repository<Site>) {}

  @Get(':idOrSlug')
  @Public()
  @ApiOperation({ summary: '공개 사이트 메타 (테마/브랜딩 포함, 민감 필드 제외)' })
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const site = await this.repo.findOne({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
    });
    if (!site || !site.isActive) throw new NotFoundException('Site not found');
    return {
      id: site.id,
      slug: site.slug,
      name: site.name,
      description: site.description,
      hostname: site.hostname,
      locales: site.locales,
      defaultLocale: site.defaultLocale,
      theme: site.theme,
      branding: site.branding,
    };
  }
}
