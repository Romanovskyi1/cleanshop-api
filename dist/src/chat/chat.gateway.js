"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const chat_service_1 = require("./chat.service");
const ai_service_1 = require("./ai.service");
const chat_message_entity_1 = require("./entities/chat-message.entity");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const users_service_1 = require("../users/users.service");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    constructor(chatService, aiService, jwt, config, users) {
        this.chatService = chatService;
        this.aiService = aiService;
        this.jwt = jwt;
        this.config = config;
        this.users = users;
        this.logger = new common_1.Logger(ChatGateway_1.name);
        this.rooms = new Map();
    }
    async handleConnection(socket) {
        try {
            const token = socket.handshake.auth?.token;
            const payload = this.jwt.verify(token, {
                secret: this.config.getOrThrow('JWT_SECRET'),
            });
            const user = await this.users.findById(payload.sub);
            if (!user || !user.isActive || !user.companyId) {
                socket.disconnect();
                return;
            }
            socket.data.userId = user.id;
            socket.data.companyId = user.companyId;
            socket.data.isManager = user.isManager;
            socket.data.name = user.displayName;
            const room = `company:${user.companyId}`;
            await socket.join(room);
            if (!this.rooms.has(user.companyId)) {
                this.rooms.set(user.companyId, new Set());
            }
            this.rooms.get(user.companyId).add(socket.id);
            socket.emit('chat:status', this.aiService.getChatStatus());
            this.logger.log(`WS connect: user=${user.id} company=${user.companyId} socket=${socket.id}`);
        }
        catch {
            this.logger.warn(`WS: отклонён неавторизованный сокет ${socket.id}`);
            socket.disconnect();
        }
    }
    handleDisconnect(socket) {
        const companyId = socket.data?.companyId;
        if (companyId) {
            this.rooms.get(companyId)?.delete(socket.id);
        }
        this.logger.log(`WS disconnect: socket=${socket.id}`);
    }
    async onMessageSend(socket, payload) {
        const { userId, companyId, name } = socket.data;
        if (!companyId || !userId)
            return;
        const ctx = await this.buildClientContext(companyId, name);
        const status = this.aiService.getChatStatus();
        const agentName = status.mode === 'ai' ? 'ИИ-ассистент' : (status.agentName ?? 'Менеджер');
        this.broadcastToCompany(companyId, 'message:typing', {
            isTyping: true,
            senderType: status.mode === 'ai' ? chat_message_entity_1.SenderType.AI : chat_message_entity_1.SenderType.MANAGER,
            senderName: agentName,
        });
        try {
            const { clientMsg, replyMsg } = await this.chatService.handleClientMessage(companyId, userId, payload.text, ctx, payload.attachmentUrl ?? null);
            this.broadcastToCompany(companyId, 'message:new', this.chatService.toWsEvent(clientMsg, name).data);
            if (replyMsg) {
                this.broadcastToCompany(companyId, 'message:typing', {
                    isTyping: false, senderType: chat_message_entity_1.SenderType.AI, senderName: agentName,
                });
                this.broadcastToCompany(companyId, 'message:new', this.chatService.toWsEvent(replyMsg, agentName).data);
            }
        }
        catch (err) {
            this.logger.error(`WS message:send error: ${err.message}`);
            this.broadcastToCompany(companyId, 'message:typing', {
                isTyping: false, senderType: chat_message_entity_1.SenderType.AI, senderName: agentName,
            });
        }
    }
    onTyping(socket, payload) {
        const { companyId, name, isManager } = socket.data;
        if (!companyId)
            return;
        socket.to(`company:${companyId}`).emit('message:typing', {
            isTyping: payload.isTyping,
            senderType: isManager ? chat_message_entity_1.SenderType.MANAGER : chat_message_entity_1.SenderType.CLIENT,
            senderName: name,
        });
    }
    async onRead(socket, payload) {
        const { companyId } = socket.data;
        if (!companyId)
            return;
        await this.chatService.markRead(companyId, payload.messageId);
        socket.to(`company:${companyId}`).emit('message:read', {
            messageId: payload.messageId,
        });
    }
    broadcastManagerMessage(companyId, managerName, text, cardPayload = null) {
        this.broadcastToCompany(companyId, 'message:new', {
            senderType: chat_message_entity_1.SenderType.MANAGER,
            senderName: managerName,
            text,
            cardPayload,
            attachmentUrl: null,
            createdAt: new Date().toISOString(),
        });
    }
    broadcastStatusUpdate(companyId) {
        const status = this.aiService.getChatStatus();
        this.broadcastToCompany(companyId, 'chat:status', status);
    }
    broadcastToCompany(companyId, event, data) {
        this.server.to(`company:${companyId}`).emit(event, data);
    }
    async buildClientContext(companyId, contactName) {
        return {
            companyName: `Company #${companyId}`,
            contactName,
            languageCode: 'en',
            activeOrders: [],
            pendingPallets: 0,
            pendingInvoices: 0,
            recentProducts: [],
        };
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "onMessageSend", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "onTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:read'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "onRead", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/chat',
        cors: {
            origin: '*',
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        ai_service_1.AiService,
        jwt_1.JwtService,
        config_1.ConfigService,
        users_service_1.UsersService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map