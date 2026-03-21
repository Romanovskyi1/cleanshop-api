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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessage = exports.MessageIntent = exports.SenderType = void 0;
const typeorm_1 = require("typeorm");
var SenderType;
(function (SenderType) {
    SenderType["CLIENT"] = "client";
    SenderType["MANAGER"] = "manager";
    SenderType["AI"] = "ai";
})(SenderType || (exports.SenderType = SenderType = {}));
var MessageIntent;
(function (MessageIntent) {
    MessageIntent["INFORMATIONAL"] = "informational";
    MessageIntent["TRANSACTIONAL"] = "transactional";
    MessageIntent["LOGISTICAL"] = "logistical";
    MessageIntent["COMPLAINT"] = "complaint";
    MessageIntent["ESCALATE"] = "escalate";
})(MessageIntent || (exports.MessageIntent = MessageIntent = {}));
let ChatMessage = class ChatMessage {
};
exports.ChatMessage = ChatMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", String)
], ChatMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'company_id' }),
    __metadata("design:type", Number)
], ChatMessage.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sender_id', nullable: true }),
    __metadata("design:type", Number)
], ChatMessage.prototype, "senderId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'sender_type',
        type: 'enum',
        enum: SenderType,
    }),
    __metadata("design:type", String)
], ChatMessage.prototype, "senderType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ChatMessage.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'attachment_url', nullable: true }),
    __metadata("design:type", String)
], ChatMessage.prototype, "attachmentUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: MessageIntent,
        nullable: true,
    }),
    __metadata("design:type", String)
], ChatMessage.prototype, "intent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ChatMessage.prototype, "cardPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_read', default: false }),
    __metadata("design:type", Boolean)
], ChatMessage.prototype, "isRead", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ChatMessage.prototype, "createdAt", void 0);
exports.ChatMessage = ChatMessage = __decorate([
    (0, typeorm_1.Entity)('chat_messages'),
    (0, typeorm_1.Index)(['companyId', 'createdAt'])
], ChatMessage);
//# sourceMappingURL=chat-message.entity.js.map