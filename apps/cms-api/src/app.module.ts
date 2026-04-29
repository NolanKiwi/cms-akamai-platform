import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { AssetsModule } from './assets/assets.module';
import { VideoModule } from './video/video.module';
import { PublishingModule } from './publishing/publishing.module';
import { PurgeModule } from './purge/purge.module';
import { SearchModule } from './search/search.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuditModule } from './audit/audit.module';
import { PreviewModule } from './preview/preview.module';
import { RedirectsModule } from './redirects/redirects.module';
import { HealthModule } from './health/health.module';
import { AkamaiModule } from './akamai/akamai.module';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';

@Module({
  imports: [
    // 설정
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // 데이터베이스
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{
          ttl: config.get('RATE_LIMIT_API_WINDOW_SEC', 60) * 1000,
          limit: config.get('RATE_LIMIT_API_MAX', 1000),
        }],
      }),
    }),

    // Queue (BullMQ)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: redisConfig,
    }),

    // 스케줄러 (예약 발행)
    ScheduleModule.forRoot(),

    // 이벤트 버스
    EventEmitterModule.forRoot({ wildcard: true }),

    // 기능 모듈
    AuthModule,
    ContentModule,
    AssetsModule,
    VideoModule,
    PublishingModule,
    PurgeModule,
    SearchModule,
    WebhooksModule,
    AuditModule,
    PreviewModule,
    RedirectsModule,
    HealthModule,
    AkamaiModule,
  ],
})
export class AppModule {}
