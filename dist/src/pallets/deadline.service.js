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
var DeadlineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadlineService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const pallets_service_1 = require("../pallets/pallets.service");
let DeadlineService = DeadlineService_1 = class DeadlineService {
    constructor(palletsService) {
        this.palletsService = palletsService;
        this.logger = new common_1.Logger(DeadlineService_1.name);
    }
    async checkDeadlines() {
        this.logger.log('Проверка дедлайнов паллет...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const openDate = new Date(today);
        openDate.setDate(openDate.getDate() + 5);
        const reminder1Date = new Date(today);
        reminder1Date.setDate(reminder1Date.getDate() + 2);
        const reminder2Date = new Date(today);
        reminder2Date.setDate(reminder2Date.getDate() + 1);
        const lockDate = new Date(today);
        this.logger.debug({
            openDate,
            reminder1Date,
            reminder2Date,
            lockDate,
        });
    }
    async lockOrderPallets(orderId, companyId) {
        try {
            const result = await this.palletsService.lockAll(orderId, companyId);
            this.logger.log(`Заказ #${orderId}: заблокировано ${result.locked} пал., ` +
                `авто-назначено ${result.autoAssigned} пал.`);
            if (result.autoAssigned > 0) {
                this.logger.warn(`Заказ #${orderId}: авто-распределено ${result.autoAssigned} паллет. ` +
                    `Уведомление клиенту отправить через TelegramService.`);
            }
        }
        catch (err) {
            this.logger.error(`Ошибка блокировки заказа #${orderId}: ${err.message}`);
        }
    }
    static buildOpenMessage(orderNumber, deadlineDate) {
        const dateStr = deadlineDate.toLocaleDateString('ru-RU', {
            day: '2-digit', month: 'long',
        });
        return (`📦 <b>Окно сборки паллет открыто</b>\n\n` +
            `Погрузка #${orderNumber}: можно распределять паллеты по фурам.\n` +
            `Дедлайн: <b>${dateStr} в 23:59</b>`);
    }
    static buildReminder1Message(orderNumber, daysLeft) {
        return (`⏳ <b>Напоминание о паллетах</b>\n\n` +
            `Погрузка #${orderNumber}: осталось <b>${daysLeft} дня</b> для сборки паллет.\n` +
            `Не забудь распределить все паллеты по фурам!`);
    }
    static buildFinalReminderMessage(orderNumber) {
        return (`🔴 <b>Последний день!</b>\n\n` +
            `Погрузка #${orderNumber}: окно закрывается сегодня в 23:59.\n` +
            `После этого паллеты будут распределены автоматически.`);
    }
    static buildLockedMessage(orderNumber, autoAssigned) {
        const autoNote = autoAssigned > 0
            ? `\n⚠️ Авто-распределено: ${autoAssigned} паллет. Проверь план загрузки.`
            : '';
        return (`🔒 <b>Окно паллет закрыто</b>\n\n` +
            `Погрузка #${orderNumber}: распределение зафиксировано.` +
            autoNote);
    }
};
exports.DeadlineService = DeadlineService;
__decorate([
    (0, schedule_1.Cron)('0 9 * * *', { name: 'pallet-deadline-check', timeZone: 'UTC' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeadlineService.prototype, "checkDeadlines", null);
exports.DeadlineService = DeadlineService = DeadlineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pallets_service_1.PalletsService])
], DeadlineService);
//# sourceMappingURL=deadline.service.js.map