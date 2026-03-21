import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';
import { ConfigModule }     from '@nestjs/config';
import { MulterModule }     from '@nestjs/platform-express';
import { memoryStorage }    from 'multer';

import { Invoice, InvoiceDelivery }       from './entities/invoice.entity';
import { InvoicesService }                from './invoices.service';
import { InvoicesController }             from './invoices.controller';
import { InvoiceDistributionService }     from './invoice-distribution.service';
import { S3StorageService }               from './channels/s3-storage.service';
import { TelegramDeliveryService }        from './channels/telegram-delivery.service';
import { EmailDeliveryService }           from './channels/email-delivery.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Invoice, InvoiceDelivery]),
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceDistributionService,
    S3StorageService,
    TelegramDeliveryService,
    EmailDeliveryService,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
