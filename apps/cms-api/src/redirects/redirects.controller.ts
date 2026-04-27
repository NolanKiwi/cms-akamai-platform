import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { RedirectsService } from './redirects.service';

class CreateRedirectDto {
  @ApiProperty() @IsString() siteId: string;
  @ApiProperty() @IsString() fromPath: string;
  @ApiProperty() @IsString() toPath: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(301) @Max(308) statusCode?: number;
}

class UpdateRedirectDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() toPath?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() statusCode?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}

class BulkRowDto {
  @ApiProperty() @IsString() from: string;
  @ApiProperty() @IsString() to: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() status?: number;
}

class BulkImportDto {
  @ApiProperty() @IsString() siteId: string;
  @ApiProperty({ type: [BulkRowDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => BulkRowDto) rows: BulkRowDto[];
}

@ApiTags('Redirects (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/redirects')
export class RedirectsController {
  constructor(private readonly service: RedirectsService) {}

  @Post()
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '리다이렉트 생성' })
  create(@Body() dto: CreateRedirectDto) {
    return this.service.create(dto.siteId, dto.fromPath, dto.toPath, dto.statusCode);
  }

  @Put(':id')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '리다이렉트 수정' })
  update(@Param('id') id: string, @Body() dto: UpdateRedirectDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '리다이렉트 삭제' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Get()
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '리다이렉트 목록' })
  list(@Query('siteId') siteId: string, @Query('page') page = 1, @Query('size') size = 50) {
    return this.service.findBySite(siteId, +page, +size);
  }

  @Post('bulk-import')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '리다이렉트 일괄 가져오기' })
  bulkImport(@Body() dto: BulkImportDto) {
    return this.service.bulkImport(dto.siteId, dto.rows);
  }
}
