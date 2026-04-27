import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { AssetsService } from './assets.service';

class UploadUrlDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiProperty() @IsString() filename: string;
  @ApiProperty() @IsString() mimeType: string;
  @ApiProperty() @IsNumber() size: number;
}

class UpdateMetaDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() altText?: string;
  @ApiProperty({ required: false }) @IsOptional() focalPointX?: number;
  @ApiProperty({ required: false }) @IsOptional() focalPointY?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsArray() tags?: string[];
}

@ApiTags('Assets (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('upload-url')
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'S3 presigned 업로드 URL 생성' })
  async getUploadUrl(@Body() dto: UploadUrlDto, @Req() req: any) {
    return this.assetsService.getUploadUrl(dto.siteId, dto.filename, dto.mimeType, dto.size, req.user.sub);
  }

  @Post(':id/complete')
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '업로드 완료 확인' })
  async confirmUpload(@Param('id') id: string) {
    return this.assetsService.confirmUpload(id);
  }

  @Get(':id')
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  async getAsset(@Param('id') id: string) {
    return this.assetsService.findById(id);
  }

  @Get()
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  async listAssets(
    @Query('siteId') siteId: string,
    @Query('type') type?: string,
    @Query('page') page = 1,
    @Query('size') size = 50,
  ) {
    return this.assetsService.findBySite(siteId, page, size, type);
  }

  @Patch(':id')
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  async updateMeta(@Param('id') id: string, @Body() dto: UpdateMetaDto) {
    return this.assetsService.updateMetadata(id, dto);
  }
}
