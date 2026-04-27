import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: config.get<string>('DATABASE_URL'),
  autoLoadEntities: true,
  synchronize: config.get('NODE_ENV') === 'development',
  logging: config.get('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
  migrations: ['dist/database/migrations/*.js'],
  migrationsRun: config.get('NODE_ENV') !== 'development',
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});
