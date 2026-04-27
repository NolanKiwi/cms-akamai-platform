import { ConfigService } from '@nestjs/config';
import { BullModuleOptions } from '@nestjs/bull';

export const redisConfig = (config: ConfigService): BullModuleOptions => ({
  redis: {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 17379),
    password: config.get<string>('REDIS_PASSWORD'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
