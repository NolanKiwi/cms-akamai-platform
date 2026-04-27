import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller()
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get('search')
  @Public()
  @ApiOperation({ summary: '공개 콘텐츠 검색' })
  @ApiQuery({ name: 'siteId', required: true })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'contentType', required: false })
  @ApiQuery({ name: 'locale', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'size', required: false })
  searchPublic(
    @Query('siteId') siteId: string,
    @Query('q') q: string,
    @Query('contentType') contentType?: string,
    @Query('locale') locale?: string,
    @Query('page') page = 1,
    @Query('size') size = 20,
  ) {
    return this.service.search({ siteId, q, contentType, locale, page: +page, size: +size });
  }

  @Get('admin/search/reindex')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '검색 인덱스 재구성 (관리자)' })
  reindex(@Query('siteId') siteId: string) {
    return { message: 'Reindex queued', siteId };
  }
}
