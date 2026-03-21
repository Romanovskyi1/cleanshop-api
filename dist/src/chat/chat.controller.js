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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const chat_gateway_1 = require("./chat.gateway");
const chat_dto_1 = require("./dto/chat.dto");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../users/user.entity");
let ChatController = class ChatController {
    constructor(chatService, gateway) {
        this.chatService = chatService;
        this.gateway = gateway;
    }
    getHistory(user, limit = 50, before) {
        return this.chatService.getHistory(user.companyId, limit, before);
    }
    getStatus() {
        return this.chatService.getChatStatus();
    }
    async sendMessage(user, dto) {
        const ctx = {
            companyName: `Company #${user.companyId}`,
            contactName: user.displayName,
            languageCode: user.languageCode ?? 'en',
            activeOrders: [],
            pendingPallets: 0,
            pendingInvoices: 0,
            recentProducts: [],
        };
        const result = await this.chatService.handleClientMessage(user.companyId, user.id, dto.text, ctx, dto.attachmentUrl);
        return {
            clientMessage: result.clientMsg,
            reply: result.replyMsg,
            escalated: result.shouldEscalate,
        };
    }
    async managerReply(manager, dto) {
        const msg = await this.chatService.saveManagerReply(dto.companyId, manager.id, dto.text);
        this.gateway.broadcastManagerMessage(dto.companyId, manager.displayName, dto.text);
        return msg;
    }
    markRead(messageId, user) {
        return this.chatService.markRead(user.companyId, messageId);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)('messages'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit', new common_1.ParseIntPipe({ optional: true }))),
    __param(2, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_1.User, Object, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('messages'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_1.User,
        chat_dto_1.SendMessageDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('manager-reply'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_1.User, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "managerReply", null);
__decorate([
    (0, common_1.Patch)('messages/:id/read'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "markRead", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('chat'),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        chat_gateway_1.ChatGateway])
], ChatController);
//# sourceMappingURL=chat.controller.js.map