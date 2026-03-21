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
var EmailDeliveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailDeliveryService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mail_1 = require("@sendgrid/mail");
let EmailDeliveryService = EmailDeliveryService_1 = class EmailDeliveryService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(EmailDeliveryService_1.name);
        mail_1.default.setApiKey(config.getOrThrow('SENDGRID_API_KEY'));
        this.from = config.getOrThrow('SENDGRID_FROM');
        this.fromName = config.get('SENDGRID_FROM_NAME', 'CleanShop B2B');
    }
    async sendInvoice(to, pdfBuffer, invoiceNumber, params) {
        const filename = `${invoiceNumber}.pdf`;
        const due = new Date(params.dueDate).toLocaleDateString('de-DE', {
            day: '2-digit', month: 'long', year: 'numeric',
        });
        try {
            const [response] = await mail_1.default.send({
                to,
                from: { email: this.from, name: this.fromName },
                subject: `Инвойс ${invoiceNumber} — € ${Number(params.totalEur).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
                html: this.buildHtmlBody({ ...params, invoiceNumber, due }),
                text: this.buildTextBody({ ...params, invoiceNumber, due }),
                attachments: [{
                        content: pdfBuffer.toString('base64'),
                        filename,
                        type: 'application/pdf',
                        disposition: 'attachment',
                    }],
            });
            const messageId = response.headers['x-message-id'] ?? null;
            this.logger.log(`Email sent → ${to} | messageId=${messageId}`);
            return { ok: true, messageId };
        }
        catch (err) {
            const msg = err?.response?.body?.errors?.[0]?.message ?? err.message;
            this.logger.error(`Email failed → ${to}: ${msg}`);
            return { ok: false, error: msg };
        }
    }
    buildHtmlBody(p) {
        const fmt = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Инвойс ${p.invoiceNumber}</title>
<style>
  body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:20px}
  .wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden}
  .header{background:#0A1F3D;padding:24px 28px}
  .header h1{color:#fff;margin:0;font-size:20px;font-weight:500}
  .header p{color:#5585E0;margin:4px 0 0;font-size:13px}
  .body{padding:24px 28px}
  .greeting{font-size:15px;color:#3D4660;margin-bottom:20px}
  .inv-num{font-size:13px;color:#9AA3B8;margin-bottom:4px}
  .amount{font-size:28px;font-weight:700;color:#0A1F3D;margin-bottom:4px}
  .due{font-size:13px;color:#B85C00;font-weight:500;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  td{padding:8px 0;font-size:13px;color:#3D4660;border-bottom:1px solid #E8ECF4}
  .tl{color:#9AA3B8}
  .tr{text-align:right;font-weight:500;color:#0A1F3D}
  .total-row td{border-bottom:none;padding-top:12px;font-size:15px}
  .sepa-box{background:#F5F7FB;border-radius:6px;padding:14px 16px;margin-bottom:20px}
  .sepa-box h3{font-size:13px;color:#9AA3B8;margin:0 0 8px;text-transform:uppercase;letter-spacing:.06em}
  .sepa-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}
  .sepa-key{color:#9AA3B8}
  .sepa-val{font-family:monospace;color:#0A1F3D;font-weight:500}
  .ref-box{background:#D8E8FF;border-radius:4px;padding:8px 10px;margin-top:8px}
  .ref-label{font-size:11px;color:#1355C1;font-weight:500;margin-bottom:2px}
  .ref-val{font-size:13px;font-family:monospace;font-weight:700;color:#0C447C}
  .footer{padding:16px 28px;background:#F5F7FB;font-size:11px;color:#9AA3B8;text-align:center}
  .btn{display:inline-block;background:#1355C1;color:#fff;text-decoration:none;padding:10px 22px;border-radius:20px;font-size:13px;font-weight:500;margin-bottom:20px}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>CleanShop B2B</h1>
    <p>Оптовый портал бытовой химии</p>
  </div>
  <div class="body">
    <p class="greeting">Уважаемый(-ая) ${p.contactName},<br>
    направляем вам инвойс по заказу #${p.orderId}.</p>

    <div class="inv-num">${p.invoiceNumber}</div>
    <div class="amount">€ ${fmt(p.totalEur)}</div>
    <div class="due">Срок оплаты: ${p.due}</div>

    <table>
      <tr><td class="tl">Компания</td><td class="tr">${p.companyName}</td></tr>
      <tr><td class="tl">Заказ</td><td class="tr">#${p.orderId}</td></tr>
      <tr><td class="tl">Сумма без НДС</td><td class="tr">€ ${fmt(p.subtotalEur)}</td></tr>
      <tr><td class="tl">НДС (${p.vatRate}%)</td><td class="tr">€ ${fmt(p.vatAmount)}</td></tr>
      <tr class="total-row">
        <td class="tl" style="font-weight:600;color:#0A1F3D">Итого к оплате</td>
        <td class="tr" style="font-size:17px;font-weight:700">€ ${fmt(p.totalEur)}</td>
      </tr>
    </table>

    <div class="sepa-box">
      <h3>Реквизиты для оплаты (SEPA)</h3>
      <div class="sepa-row"><span class="sepa-key">Банк</span><span class="sepa-val">Commerzbank AG</span></div>
      <div class="sepa-row"><span class="sepa-key">IBAN</span><span class="sepa-val">DE89 3704 0044 0532 0130 00</span></div>
      <div class="sepa-row"><span class="sepa-key">BIC</span><span class="sepa-val">COBADEFFXXX</span></div>
      <div class="ref-box">
        <div class="ref-label">Обязательно укажите в назначении платежа:</div>
        <div class="ref-val">${p.invoiceNumber}</div>
      </div>
    </div>

    <p style="font-size:12px;color:#9AA3B8;margin:0">
      PDF-инвойс прикреплён к этому письму. При возникновении вопросов свяжитесь
      с вашим менеджером через Telegram.
    </p>
  </div>
  <div class="footer">
    CleanShop B2B · GreenChem GmbH · Frankfurt am Main, Germany<br>
    Инвойсы хранятся в соответствии с EU Accounting Directive (7 лет)
  </div>
</div>
</body>
</html>`;
    }
    buildTextBody(p) {
        const fmt = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2 });
        return [
            `Инвойс ${p.invoiceNumber}`,
            `Компания: ${p.companyName}`,
            `Заказ: #${p.orderId}`,
            `Сумма: € ${fmt(p.totalEur)}`,
            `Срок оплаты: ${p.due}`,
            '',
            'PDF-инвойс прикреплён к письму.',
            'Назначение платежа SEPA: ' + p.invoiceNumber,
        ].join('\n');
    }
};
exports.EmailDeliveryService = EmailDeliveryService;
exports.EmailDeliveryService = EmailDeliveryService = EmailDeliveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailDeliveryService);
//# sourceMappingURL=email-delivery.service.js.map