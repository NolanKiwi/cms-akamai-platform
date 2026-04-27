import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContentService } from '../content/content.service';

@Injectable()
export class ScheduledPublishService {
  private readonly logger = new Logger('ScheduledPublish');

  constructor(private contentService: ContentService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduled() {
    const results = await this.contentService.runScheduledPublish();
    if (results.length > 0) {
      this.logger.log(`예약 발행 처리: ${results.length}건`);
    }
  }
}
