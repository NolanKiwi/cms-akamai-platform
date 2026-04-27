import {
  Controller, Get, Post, Put, Patch, Delete, Param, Query, Body,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { PublishDto } from './dto/publish.dto';
import { ScheduleDto } from './dto/schedule.dto';
import { RollbackDto } from './dto/rollback.dto';

@ApiTags('Content (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/content')
export class ContentAdminController {
  constructor(private readonly contentService: ContentService) {}

  @Post(':type')
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '새 콘텐츠 생성' })
  async create(
    @Param('type') type: string,
    @Body() dto: CreateContentDto,
    @Req() req: any,
  ) {
    return this.contentService.create(type, dto, req.user.sub);
  }

  @Get(':type')
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '콘텐츠 목록 (어드민)' })
  async list(
    @Param('type') type: string,
    @Query('siteId') siteId: string,
    @Query('locale') locale?: string,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('size') size = 50,
  ) {
    return this.contentService.list(type, siteId, { locale, status, page: +page, size: +size });
  }

  @Get(':type/:id')
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '콘텐츠 상세 조회 (어드민)' })
  async getAdmin(
    @Param('id') id: string,
    @Query('version') version?: number,
  ) {
    return this.contentService.getAdmin(id, version);
  }

  @Put(':type/:id')
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '콘텐츠 수정 (새 버전 생성)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContentDto,
    @Req() req: any,
  ) {
    return this.contentService.update(id, dto, req.user.sub);
  }

  @Get(':type/:id/versions')
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '버전 이력 조회' })
  async getVersions(@Param('id') id: string) {
    return this.contentService.getVersionHistory(id);
  }

  @Post(':type/:id/submit-review')
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '검토 요청' })
  async submitReview(@Param('id') id: string, @Req() req: any) {
    return this.contentService.submitForReview(id, req.user.sub);
  }

  @Post(':type/:id/approve')
  @Roles(UserRole.PUBLISHER, UserRole.ADMIN)
  @ApiOperation({ summary: '승인' })
  async approve(@Param('id') id: string, @Req() req: any) {
    return this.contentService.approve(id, req.user.sub);
  }

  @Post(':type/:id/publish')
  @Roles(UserRole.PUBLISHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '즉시 발행' })
  async publish(@Param('id') id: string, @Req() req: any) {
    return this.contentService.publish(id, req.user.sub);
  }

  @Post(':type/:id/schedule')
  @Roles(UserRole.PUBLISHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '예약 발행' })
  async schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleDto,
    @Req() req: any,
  ) {
    return this.contentService.schedule(id, dto.scheduledAt, req.user.sub);
  }

  @Post(':type/:id/rollback')
  @Roles(UserRole.PUBLISHER, UserRole.ADMIN)
  @ApiOperation({ summary: '특정 버전으로 롤백' })
  async rollback(
    @Param('id') id: string,
    @Body() dto: RollbackDto,
    @Req() req: any,
  ) {
    return this.contentService.rollback(id, dto.toVersion, req.user.sub);
  }

  @Delete(':type/:id')
  @Roles(UserRole.PUBLISHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '콘텐츠 아카이브 (소프트 삭제)' })
  async archive(@Param('id') id: string, @Req() req: any) {
    await this.contentService.archive(id, req.user.sub);
  }
}
