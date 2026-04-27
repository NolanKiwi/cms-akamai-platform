import { Controller, Post, Get, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { PurgeService } from './purge.service';
import { PurgeTriggerType } from './entities/purge-log.entity';

class PurgeTagsDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) tags: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() reason?: string;
}

class PurgeUrlsDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) urls: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() reason?: string;
}

@ApiTags('Purge (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/purge')
export class PurgeController {
  constructor(private readonly purgeService: PurgeService) {}

  @Post('tags')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '캐시 태그 수동 퍼지' })
  async purgeTags(@Body() dto: PurgeTagsDto, @Req() req: any) {
    const jobId = await this.purgeService.enqueuePurge({
      triggerType: PurgeTriggerType.MANUAL,
      scope: 'tag',
      objects: dto.tags,
      initiatedBy: req.user.sub,
    });
    return { jobId, tagCount: dto.tags.length, estimatedSeconds: 10 };
  }

  @Post('urls')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'URL 수동 퍼지' })
  async purgeUrls(@Body() dto: PurgeUrlsDto, @Req() req: any) {
    const jobId = await this.purgeService.enqueuePurge({
      triggerType: PurgeTriggerType.MANUAL,
      scope: 'url',
      objects: dto.urls,
      initiatedBy: req.user.sub,
    });
    return { jobId, urlCount: dto.urls.length, estimatedSeconds: 10 };
  }

  @Get(':id')
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '퍼지 상태 조회' })
  async getStatus(@Param('id') id: string) {
    return this.purgeService.getPurgeStatus(id);
  }

  @Get()
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '퍼지 이력 조회' })
  async getHistory(
    @Query('page') page = 1,
    @Query('size') size = 50,
    @Query('triggerType') triggerType?: string,
    @Query('status') status?: string,
  ) {
    return this.purgeService.getPurgeHistory({ page, size, triggerType, status });
  }
}
