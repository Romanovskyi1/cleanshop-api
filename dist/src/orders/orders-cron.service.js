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
var OrdersCronService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const orders_service_1 = require("./orders.service");
const config_1 = require("@nestjs/config");
let OrdersCronService = OrdersCronService_1 = class OrdersCronService {
    constructor(orders, config) {
        this.orders = orders;
        this.config = config;
        this.logger = new common_1.Logger(OrdersCronService_1.name);
    }
    async openPalletWindows() {
        this.logger.log('[Cron] Checking orders to open pallet windows...');
        const ordersToOpen = await this.orders.findOrdersToOpenWindow(new Date());
        if (!ordersToOpen.length) {
            this.logger.log('[Cron] No orders to open today');
            return;
        }
        for (const order of ordersToOpen) {
            try {
                await this.orders.openPalletWindow(order.id);
                await this.sendPush(order.companyId, this.buildOpenMsg(order.id, new Date()));
                this.logger.log(`[Cron] Pallet window opened: order #${order.id}`);
            }
            catch (err) {
                this.logger.error(`[Cron] Failed to open window for order #${order.id}: ${err.message}`);
            }
        }
    }
    async remindTwoDays() {
        const orders = await this.orders.findOrdersForReminder(2);
        this.logger.log(`[Cron] 2-day reminder: ${orders.length} orders`);
        for (const o of orders) {
            await this.sendPush(o.companyId, `⏳ <b>Напоминание о паллетах</b>\n\n` +
                `Погрузка #${o.id}: осталось <b>2 дня</b> для сборки паллет.\n` +
                `Дедлайн: ${this.fmtDate(new Date())}`).catch(e => this.logger.error(`Push failed: ${e.message}`));
        }
    }
    async remindOneDay() {
        const orders = await this.orders.findOrdersForReminder(1);
        this.logger.log(`[Cron] 1-day reminder: ${orders.length} orders`);
        for (const o of orders) {
            await this.sendPush(o.companyId, `🔴 <b>Последний день!</b>\n\n` +
                `Погрузка #${o.id}: окно закрывается сегодня в 23:59.\n` +
                `После этого паллеты будут распределены автоматически.`).catch(e => this.logger.error(`Push failed: ${e.message}`));
        }
    }
    async autoLockExpired() {
        this.logger.log('[Cron] Checking expired pallet windows...');
        const expired = await this.orders.findExpiredWindows();
        if (!expired.length) {
            this.logger.log('[Cron] No expired windows');
            return;
        }
        for (const order of expired) {
            try {
                await this.orders.autoLock(order.id);
                await this.sendPush(order.companyId, `🔒 <b>Окно паллет закрыто</b>\n\n` +
                    `Погрузка #${order.id}: распределение зафиксировано автоматически.\n` +
                    `Проверьте план загрузки.`).catch(() => { });
                this.logger.log(`[Cron] Auto-locked order #${order.id}`);
            }
            catch (err) {
                this.logger.error(`[Cron] Auto-lock failed for #${order.id}: ${err.message}`);
            }
        }
    }
    async sendPush(companyId, text) {
        const token = this.config.get('TELEGRAM_BOT_TOKEN');
        if (!token)
            return;
        this.logger.debug(`[Push] company=${companyId}: ${text.slice(0, 80)}...`);
    }
    buildOpenMsg(orderId, closes) {
        return (`📦 <b>Окно сборки паллет открыто</b>\n\n` +
            `Погрузка #${orderId}: можно распределять паллеты по фурам.\n` +
            `Дедлайн: <b>${this.fmtDate(closes)}</b>`);
    }
    fmtDate(d) {
        return d.toLocaleDateString('ru-RU', {
            day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
        });
    }
};
exports.OrdersCronService = OrdersCronService;
__decorate([
    (0, schedule_1.Cron)('0 9 * * *', { name: 'open-pallet-windows', timeZone: 'UTC' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrdersCronService.prototype, "openPalletWindows", null);
__decorate([
    (0, schedule_1.Cron)('5 9 * * *', { name: 'reminder-2days', timeZone: 'UTC' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrdersCronService.prototype, "remindTwoDays", null);
__decorate([
    (0, schedule_1.Cron)('10 9 * * *', { name: 'reminder-1day', timeZone: 'UTC' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrdersCronService.prototype, "remindOneDay", null);
__decorate([
    (0, schedule_1.Cron)('1 0 * * *', { name: 'auto-lock-expired', timeZone: 'UTC' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrdersCronService.prototype, "autoLockExpired", null);
exports.OrdersCronService = OrdersCronService = OrdersCronService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [orders_service_1.OrdersService,
        config_1.ConfigService])
], OrdersCronService);
//# sourceMappingURL=orders-cron.service.js.map