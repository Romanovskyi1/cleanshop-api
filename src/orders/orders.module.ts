// src/orders/orders.module.ts
import { Module }            from '@nestjs/common';
import { TypeOrmModule }     from '@nestjs/typeorm';
import { ConfigModule }      from '@nestjs/config';

import { Order }             from './entities/order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrdersService }     from './orders.service';
import { OrdersController }  from './orders.controller';
import { OrdersCronService } from './orders-cron.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Order, OrderStatusHistory]),
  ],
  controllers: [OrdersController],
  providers:   [OrdersService, OrdersCronService],
  exports:     [OrdersService], // нужен PalletsModule, InvoicesModule, ChatModule
})
export class OrdersModule {}
