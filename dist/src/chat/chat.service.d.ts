import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatMessage } from './entities/chat-message.entity';
import { AiService } from './ai.service';
import { ParsedAiResponse, WsMessageEvent } from './dto/chat.dto';
import { ClientContext } from './prompts/system-prompt';
export declare class ChatService {
    private readonly messages;
    private readonly ai;
    private readonly config;
    private readonly logger;
    constructor(messages: Repository<ChatMessage>, ai: AiService, config: ConfigService);
    getHistory(companyId: number, limit?: number, before?: string): Promise<ChatMessage[]>;
    handleClientMessage(companyId: number, senderId: number, text: string, ctx: ClientContext, attachmentUrl?: string | null): Promise<{
        clientMsg: ChatMessage;
        replyMsg: ChatMessage | null;
        aiResponse: ParsedAiResponse | null;
        shouldEscalate: boolean;
    }>;
    saveManagerReply(companyId: number, managerId: number, text: string, attachmentUrl?: string | null): Promise<ChatMessage>;
    markRead(companyId: number, messageId: string): Promise<void>;
    getChatStatus(): {
        mode: "ai" | "human";
        agentName?: string;
    };
    private saveMessage;
    private buildAiHistory;
    private escalateToManager;
    toWsEvent(msg: ChatMessage, senderName: string): WsMessageEvent;
}
