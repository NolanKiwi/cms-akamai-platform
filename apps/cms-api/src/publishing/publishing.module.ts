import { Module } from '@nestjs/common';
import { ScheduledPublishService } from './scheduled-publish.service';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [ContentModule],
  providers: [ScheduledPublishService],
})
export class PublishingModule {}
