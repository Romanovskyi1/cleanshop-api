import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto } from './dto/chat.dto';
import { User } from '../users/user.entity';
export declare class ChatController {
    private readonly chatService;
    private readonly gateway;
    constructor(chatService: ChatService, gateway: ChatGateway);
    getHistory(user: User, limit?: number, before?: string): Promise<import("./entities/chat-message.entity").ChatMessage[]>;
    getStatus(): {
        mode: "ai" | "human";
        agentName?: string;
    };
    sendMessage(user: User, dto: SendMessageDto): Promise<{
        clientMessage: import("./entities/chat-message.entity").ChatMessage;
        reply: import("./entities/chat-message.entity").ChatMessage;
        escalated: boolean;
    }>;
    managerReply(manager: User, dto: {
        companyId: number;
        text: string;
    }): Promise<import("./entities/chat-message.entity").ChatMessage>;
    markRead(messageId: string, user: User): Promise<void>;
}
