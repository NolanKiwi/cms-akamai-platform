import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('CMS_API_PORT', 17000);

  // Trust reverse proxy (nginx) for correct req.ip / X-Forwarded-* handling
  const httpAdapter = app.getHttpAdapter().getInstance() as any;
  if (typeof httpAdapter.set === 'function') httpAdapter.set('trust proxy', 1);

  // Security
  app.use(helmet({
    contentSecurityPolicy: false, // Swagger UI 호환
  }));
  app.use(compression());

  // CORS (admin console + frontend)
  const corsExtra = (config.get<string>('CORS_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const publicBase = config.get<string>('PUBLIC_BASE_URL') || '';
  const corsOrigins = Array.from(
    new Set(
      [
        `http://localhost:${config.get('CMS_ADMIN_PORT', 17001)}`,
        `http://localhost:${config.get('WEB_FRONTEND_PORT', 17002)}`,
        publicBase,
        ...corsExtra,
      ].filter(Boolean),
    ),
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Preview-Token'],
  });
  logger.log(`CORS allow-list: ${corsOrigins.join(', ')}`);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CMS Akamai Platform API')
      .setDescription('Production-grade CMS + Akamai CDN API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'api-key')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`CMS API running on port ${port}`);
  logger.log(`Environment: ${config.get('NODE_ENV', 'development')}`);
}

bootstrap().catch(err => {
  console.error('Failed to start CMS API:', err);
  process.exit(1);
});
