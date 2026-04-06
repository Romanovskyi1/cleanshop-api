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
    SENT = "sent",
    FAILED = "failed",
    RESENT = "resent"
}
export declare class Invoice {
    id: number;
    invoiceNumber: string;
    companyId: number;
    orderId: number | null;
    issuedAt: Date;
    dueDate: string;
    subtotalEur: number;
    vatRate: number;
    vatAmount: number;
    totalEur: number;
    status: InvoiceStatus;
    pdfUrl: string | null;
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
    createdAt: Date;
    updatedAt: Date;
}
