import { SenderType, MessageIntent } from '../entities/chat-message.entity';
export declare class SendMessageDto {
    text: string;
    attachmentUrl?: string;
}
export declare class GetMessagesDto {
    before?: string;
    limit?: number;
}
export interface WsMessageEvent {
    event: 'message:new';
    data: {
        id: string;
        senderType: SenderType;
        senderName: string;
        text: string;
        cardPayload: Record<string, unknown> | null;
        attachmentUrl: string | null;
        createdAt: string;
    };
}
export interface WsTypingEvent {
    event: 'message:typing';
    data: {
        isTyping: boolean;
        senderType: SenderType;
        senderName: string;
    };
}
export interface WsStatusEvent {
    event: 'chat:status';
    data: {
        mode: 'ai' | 'human';
        agentName?: string;
        onlineAt?: string;
    };
}
export interface WsReadEvent {
    event: 'message:read';
    data: {
        messageId: string;
    };
}
export interface WsSendPayload {
    text: string;
    attachmentUrl?: string;
}
export interface WsTypingPayload {
    isTyping: boolean;
}
export interface ParsedAiResponse {
    text: string;
    intent: MessageIntent;
    confidence: number;
    cardPayload: Record<string, unknown> | null;
    escalation: {
        reason: string;
        urgency: 'normal' | 'high' | 'critical';
    } | null;
}
