import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { PalletsService }  from './pallets.service';
import { PalletsController } from './pallets.controller';
import { Pallet, PalletItem } from './entities/pallet.entity';
import { Truck }           from '../../orders/entities/truck.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pallet, PalletItem, Truck]),
  ],
  controllers: [PalletsController],
  providers:   [PalletsService],
  exports:     [PalletsService], // нужен OrdersModule для lockAll()
})
export class PalletsModule {}
