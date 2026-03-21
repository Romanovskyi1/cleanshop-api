import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { WsSendPayload, WsTypingPayload } from './dto/chat.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly chatService;
    private readonly aiService;
    private readonly jwt;
    private readonly config;
    private readonly users;
    server: Server;
    private readonly logger;
    private readonly rooms;
    constructor(chatService: ChatService, aiService: AiService, jwt: JwtService, config: ConfigService, users: UsersService);
    handleConnection(socket: Socket): Promise<void>;
    handleDisconnect(socket: Socket): void;
    onMessageSend(socket: Socket, payload: WsSendPayload): Promise<void>;
    onTyping(socket: Socket, payload: WsTypingPayload): void;
    onRead(socket: Socket, payload: {
        messageId: string;
    }): Promise<void>;
    broadcastManagerMessage(companyId: number, managerName: string, text: string, cardPayload?: Record<string, unknown> | null): void;
    broadcastStatusUpdate(companyId: number): void;
    private broadcastToCompany;
    private buildClientContext;
}
