export declare enum SenderType {
    CLIENT = "client",
    MANAGER = "manager",
    AI = "ai"
}
export declare enum MessageIntent {
    INFORMATIONAL = "informational",
    TRANSACTIONAL = "transactional",
    LOGISTICAL = "logistical",
    COMPLAINT = "complaint",
    ESCALATE = "escalate"
}
export declare class ChatMessage {
    id: string;
    companyId: number;
    senderId: number | null;
    senderType: SenderType;
    text: string;
    attachmentUrl: string | null;
    intent: MessageIntent | null;
    cardPayload: Record<string, unknown> | null;
    isRead: boolean;
    createdAt: Date;
}
