import { Module }           from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD }       from '@nestjs/core';

import { AuthModule }  from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User }        from './users/user.entity';

@Module({
  imports: [
    // ── Config — глобально, доступен везде ──────────────────────────
    ConfigModule.forRoot({
      isGlobal:    true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── TypeORM ─────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        type:        'postgres',
        url:         config.getOrThrow<string>('DATABASE_URL'),
        entities:    [User],   // добавлять по мере создания сущностей
        synchronize: config.get('NODE_ENV') === 'development', // ТОЛЬКО dev
        logging:     config.get('NODE_ENV') === 'development',
        ssl: config.get('NODE_ENV') === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    // ── Rate limiting ────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl:   config.get<number>('RATE_LIMIT_TTL', 60) * 1000,
        limit: config.get<number>('RATE_LIMIT_MAX', 100),
      }]),
    }),

    // ── Feature modules ──────────────────────────────────────────────
    UsersModule,
    AuthModule,
    // ProductsModule,   ← добавишь в День 2
    // OrdersModule,     ← добавишь в День 3
    // PalletsModule,    ← добавишь в День 3
    // InvoicesModule,   ← Фаза 2
    // ChatModule,       ← Фаза 2
  ],
  providers: [
    // Глобальный rate-limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
