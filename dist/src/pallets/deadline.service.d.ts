import { PalletsService } from '../pallets/pallets.service';
export declare class DeadlineService {
    private readonly palletsService;
    private readonly logger;
    constructor(palletsService: PalletsService);
    checkDeadlines(): Promise<void>;
    lockOrderPallets(orderId: number, companyId: number): Promise<void>;
    static buildOpenMessage(orderNumber: number, deadlineDate: Date): string;
    static buildReminder1Message(orderNumber: number, daysLeft: number): string;
    static buildFinalReminderMessage(orderNumber: number): string;
    static buildLockedMessage(orderNumber: number, autoAssigned: number): string;
}
