import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ContentService } from './content.service';
import { CacheTagService } from './cache-tag.service';
import { ListContentDto } from './dto/list-content.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Content (Public)')
@Controller('content')
@Public()
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly cacheTagService: CacheTagService,
  ) {}

  @Get(':type')
  @ApiOperation({ summary: '콘텐츠 목록 조회 (공개, 캐시됨)' })
  async list(
    @Param('type') type: string,
    @Query() dto: ListContentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.contentService.list(type, dto);

    this.cacheTagService.setSurrogateHeaders(
      res,
      [`listing:${type}`, `site:${dto.siteId || 'all'}`],
      120,
    );

    return result;
  }

  @Get(':type/:slug')
  @ApiOperation({ summary: '슬러그로 콘텐츠 조회 (공개, 캐시됨)' })
  async getBySlug(
    @Param('type') type: string,
    @Param('slug') slug: string,
    @Query('locale') locale = 'en',
    @Query('siteId') siteId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.contentService.getBySlug(type, slug, locale, siteId);
    if (!result) return null;

    this.cacheTagService.setSurrogateHeaders(
      res,
      result.cacheTags || [`${type}:${result.id}`, `page:${slug}`],
      300,
    );

    return result;
  }
}
