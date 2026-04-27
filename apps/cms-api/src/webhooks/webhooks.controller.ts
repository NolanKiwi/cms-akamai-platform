import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { WebhooksService } from './webhooks.service';
import { WebhookEvent } from './entities/webhook.entity';

class CreateWebhookDto {
  @ApiProperty() @IsString() siteId: string;
  @ApiProperty() @IsUrl() url: string;
  @ApiProperty({ enum: WebhookEvent, isArray: true }) @IsArray() events: WebhookEvent[];
  @ApiProperty() @IsString() secret: string;
}

class UpdateWebhookDto {
  @ApiProperty({ required: false }) @IsOptional() @IsUrl() url?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsArray() events?: WebhookEvent[];
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('Webhooks (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post()
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '웹훅 생성' })
  create(@Body() dto: CreateWebhookDto) {
    return this.service.createWebhook(dto.siteId, dto.url, dto.events, dto.secret);
  }

  @Put(':id')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '웹훅 수정' })
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.service.updateWebhook(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '웹훅 삭제' })
  delete(@Param('id') id: string) {
    return this.service.deleteWebhook(id);
  }

  @Get()
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '웹훅 목록' })
  list(@Query('siteId') siteId: string) {
    return this.service.listWebhooks(siteId);
  }

  @Get(':id/deliveries')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '웹훅 전달 이력' })
  deliveries(@Param('id') id: string, @Query('page') page = 1, @Query('size') size = 50) {
    return this.service.getDeliveries(id, +page, +size);
  }
}
