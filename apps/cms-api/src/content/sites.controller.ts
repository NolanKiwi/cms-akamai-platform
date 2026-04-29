import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { Site, SiteTheme, SiteBranding } from './entities/site.entity';

class CreateSiteDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() hostname: string;
  @ApiProperty({ type: [String] }) @IsArray() locales: string[];
  @ApiProperty() @IsString() defaultLocale: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() theme?: SiteTheme;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() branding?: SiteBranding;
}

class UpdateSiteDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() hostname?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsArray() locales?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() defaultLocale?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() theme?: SiteTheme;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() branding?: SiteBranding;
}

@ApiTags('Sites (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/sites')
export class SitesController {
  constructor(@InjectRepository(Site) private repo: Repository<Site>) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '사이트 생성' })
  create(@Body() dto: CreateSiteDto) {
    const site = this.repo.create(dto);
    return this.repo.save(site);
  }

  @Get()
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '사이트 목록' })
  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  @Get(':id')
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '사이트 조회' })
  findOne(@Param('id') id: string) {
    return this.repo.findOne({ where: { id } });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '사이트 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id } });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '사이트 부분 수정' })
  async patch(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id } });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '사이트 삭제' })
  async remove(@Param('id') id: string) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
