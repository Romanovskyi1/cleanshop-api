export declare enum InvoiceStatus {
    PENDING = "pending",
    PAID = "paid",
    OVERDUE = "overdue",
    CANCELLED = "cancelled"
}
export declare enum DeliveryChannel {
    TELEGRAM_PERSONAL = "telegram_personal",
    TELEGRAM_GROUP = "telegram_group",
    EMAIL = "email"
}
export declare enum DeliveryStatus {
    PENDING = "pending",
    SENT = "sent",
    FAILED = "failed"
}
export declare class Invoice {
    id: number;
    invoiceNumber: string;
    companyId: number;
    orderId: number | null;
    issuedBy: number;
    dueDate: string;
    subtotalEur: number;
    vatRate: number;
    vatAmount: number;
    totalEur: number;
    status: InvoiceStatus;
    pdfUrl: string | null;
    pdfS3Key: string | null;
    paidAt: Date | null;
    deliveries: InvoiceDelivery[];
    createdAt: Date;
    updatedAt: Date;
    get isOverdue(): boolean;
}
export declare class InvoiceDelivery {
    id: number;
    invoiceId: number;
    invoice: Invoice;
    channel: DeliveryChannel;
    status: DeliveryStatus;
    recipient: string | null;
    errorMessage: string | null;
    sentAt: Date | null;
    attempts: number;
    externalId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
