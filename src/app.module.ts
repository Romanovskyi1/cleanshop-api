import { Module }           from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD }       from '@nestjs/core';

import { AuthModule }  from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CompaniesModule } from './companies/companies.module';
import { OrdersModule } from './orders/orders.module';
import { PalletsModule } from './pallets/pallets.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ChatModule } from './chat/chat.module';
import { User }        from './users/user.entity';
import { Product }     from './products/entities/product.entity';
import { Company }     from './companies/entities/company.entity';
import { Order }       from './orders/entities/order.entity';
import { OrderStatusHistory } from './orders/entities/order-status-history.entity';
import { Truck }       from './orders/entities/truck.entity';
import { Pallet, PalletItem } from './pallets/entities/pallet.entity';
import { Invoice, InvoiceDelivery } from './invoices/entities/invoice.entity';
import { ChatMessage } from './chat/entities/chat-message.entity';

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
        entities:    [User, Product, Company, Order, OrderStatusHistory, Truck, Pallet, PalletItem, Invoice, InvoiceDelivery, ChatMessage],   // добавлять по мере создания сущностей
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
    ProductsModule,
    CompaniesModule,
    OrdersModule,
    PalletsModule,
    InvoicesModule,
    ChatModule,
  ],
  providers: [
    // Глобальный rate-limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
