import { OrdersService } from './orders.service';
import { ConfigService } from '@nestjs/config';
export declare class OrdersCronService {
    private readonly orders;
    private readonly config;
    private readonly logger;
    constructor(orders: OrdersService, config: ConfigService);
    openPalletWindows(): Promise<void>;
    remindTwoDays(): Promise<void>;
    remindOneDay(): Promise<void>;
    autoLockExpired(): Promise<void>;
    private sendPush;
    private buildOpenMsg;
    private fmtDate;
}
