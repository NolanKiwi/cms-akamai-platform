import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { VideoService } from './video.service';

@ApiTags('Video')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/video')
export class VideoController {
  constructor(private svc: VideoService) {}

  @Post()
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  create(@Body() body: any, @Req() req: any) {
    return this.svc.create({ ...body, createdBy: req.user.sub });
  }

  @Get()
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  list(@Req() req: any) {
    return this.svc.findBySite(req.query?.siteId);
  }

  @Get(':id')
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  get(@Param('id') id: string) { return this.svc.findById(id); }

  @Patch(':id')
  @Roles(UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Post(':id/token')
  @Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.PUBLISHER, UserRole.DEVELOPER, UserRole.ADMIN)
  token(@Param('id') id: string, @Req() req: any) { return this.svc.generateToken(id, req.user.sub); }
}
