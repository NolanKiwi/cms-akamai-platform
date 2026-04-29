import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentAdminController } from './content-admin.controller';
import { SitesController } from './sites.controller';
import { SitesPublicController } from './sites-public.controller';
import { ContentService } from './content.service';
import { CacheTagService } from './cache-tag.service';
import { ContentEntry } from './entities/content-entry.entity';
import { ContentVersion } from './entities/content-version.entity';
import { Site } from './entities/site.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentEntry, ContentVersion, Site]),
    AuditModule,
  ],
  controllers: [ContentController, ContentAdminController, SitesController, SitesPublicController],
  providers: [ContentService, CacheTagService],
  exports: [ContentService, CacheTagService],
})
export class ContentModule {}
