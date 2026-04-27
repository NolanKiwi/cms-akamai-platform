import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { PurgeController } from './purge.controller';
import { PurgeService } from './purge.service';
import { PurgeLog } from './entities/purge-log.entity';
import { AkamaiPurgeClient } from './akamai-purge.client';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurgeLog]),
    BullModule.registerQueue({ name: 'purge' }),
    ContentModule,
  ],
  controllers: [PurgeController],
  providers: [PurgeService, AkamaiPurgeClient],
  exports: [PurgeService],
})
export class PurgeModule {}
