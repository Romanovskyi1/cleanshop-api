import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { PalletsService }  from './pallets.service';
import { PalletsController } from './pallets.controller';
import { Pallet, PalletItem } from './entities/pallet.entity';
import { Truck }           from '../orders/entities/truck.entity';
import { Order }           from '../orders/entities/order.entity';
import { Product }         from '../products/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pallet, PalletItem, Truck, Order, Product]),
  ],
  controllers: [PalletsController],
  providers:   [PalletsService],
  exports:     [PalletsService], // нужен OrdersModule для lockAll()
})
export class PalletsModule {}
