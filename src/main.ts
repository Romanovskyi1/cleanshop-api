import { NestFactory }          from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join }                   from 'path';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService }          from '@nestjs/config';
import helmet                     from 'helmet';
import { AppModule }              from './app.module';

async function bootstrap() {
  const app    = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const isProd = config.get('NODE_ENV') === 'production';

  // ── Security headers ────────────────────────────────────────────────
  app.use(helmet({
    // Telegram WebApp грузится в iframe — разрешаем web.telegram.org
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // ── CORS ────────────────────────────────────────────────────────────
  const origins = (config.get<string>('CORS_ORIGINS', '') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin:      origins.length ? origins : true,
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Global prefix ───────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  // ── Validation pipe ─────────────────────────────────────────────────
  // whitelist:   отбрасывает лишние поля из DTO
  // forbidNonWhitelisted: выбрасывает ошибку при лишних полях
  // transform:   автоматически преобразует типы (string → number)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
      transformOptions:     { enableImplicitConversion: true },
    }),
  );

  // ── Shutdown hooks (для Docker graceful stop) ───────────────────────
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`🚀 CleanShop API запущен: http://localhost:${port}/api/v1`);
  logger.log(`   NODE_ENV: ${config.get('NODE_ENV')}`);
  logger.log(`   CORS origins: ${origins.join(', ') || 'all'}`);

  if (!isProd) {
    logger.warn('⚠️  synchronize=true — только для разработки!');
  }
}

bootstrap();
