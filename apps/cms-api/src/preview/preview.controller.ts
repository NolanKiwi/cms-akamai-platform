import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import { PreviewService } from './preview.service';

class GenerateTokenDto {
  @ApiProperty() @IsString() contentEntryId: string;
  @ApiProperty() @IsString() siteId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() versionId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() ttlSeconds?: number;
}

@ApiTags('Preview')
@Controller('admin/preview')
export class PreviewController {
  constructor(private readonly service: PreviewService) {}

  @Post('token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '프리뷰 토큰 생성' })
  generateToken(@Body() dto: GenerateTokenDto) {
    const token = this.service.generateToken(dto.contentEntryId, dto.siteId, dto.versionId, dto.ttlSeconds);
    return { token, expiresIn: dto.ttlSeconds ?? 3600 };
  }

  @Get('validate')
  @Public()
  @ApiOperation({ summary: '프리뷰 토큰 검증' })
  validateToken(@Query('token') token: string) {
    return this.service.validateToken(token);
  }
}
