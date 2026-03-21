import {
  Controller, Get, Post, Patch, Param,
  Body, Query, ParseIntPipe,
  UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor }      from '@nestjs/platform-express';
import { memoryStorage }        from 'multer';

import { InvoicesService }      from './invoices.service';
import {
  UploadInvoiceDto, UpdateInvoiceStatusDto,
  ResendInvoiceDto, InvoiceQueryDto,
} from './dto/invoice.dto';
import { ClientDeliveryContacts } from './invoice-distribution.service';
import { CurrentUser }  from '../common/decorators/current-user.decorator';
import { Roles }        from '../common/decorators/roles.decorator';
import { User, UserRole } from '../users/user.entity';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  // ══════════════════════════════════════════════════════════════════════
  // МЕНЕДЖЕР: загрузка и рассылка
  // ══════════════════════════════════════════════════════════════════════

  /**
   * POST /invoices/upload
   * Менеджер загружает PDF и запускает авторассылку.
   *
   * multipart/form-data:
   *   file        — PDF-файл
   *   invoiceNumber, orderId, companyId, issuedAt, dueDate,
   *   subtotalEur, vatRate, vatAmount, totalEur — метаданные
   *   channels    — (опционально) JSON-массив каналов
   *
   * Пример curl:
   *   curl -X POST /api/v1/invoices/upload \
   *     -H "Authorization: Bearer <token>" \
   *     -F "file=@INV-2025-0047.pdf;type=application/pdf" \
   *     -F "invoiceNumber=INV-2025-0047" \
   *     -F "orderId=4" \
   *     -F "companyId=1" \
   *     -F "issuedAt=2025-03-10T00:00:00Z" \
   *     -F "dueDate=2025-04-09" \
   *     -F "subtotalEur=15960.00" \
   *     -F "vatRate=23.00" \
   *     -F "vatAmount=3670.80" \
   *     -F "totalEur=19630.80"
   */
  @Post('upload')
  @Roles(UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(), // PDF в памяти → Buffer
    limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        return cb(new BadRequestException('Только PDF-файлы'), false);
      }
      cb(null, true);
    },
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadInvoiceDto,
    @CurrentUser() manager: User,
  ) {
    if (!file) throw new BadRequestException('PDF-файл обязателен');

    // В реальном коде — загружать из CompanyService / UserService
    const contacts = await this.resolveContacts(dto.companyId);

    return this.service.uploadAndDistribute(
      manager.id,
      dto,
      file.buffer,
      file.originalname,
      contacts,
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // ПРОСМОТР
  // ══════════════════════════════════════════════════════════════════════

  /**
   * GET /invoices
   * Список инвойсов (для менеджера — все, для клиента — только своей компании).
   */
  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query() query: InvoiceQueryDto,
  ) {
    if (!user.isManager) {
      // Клиент видит только свои
      return this.service.findByCompany(user.companyId);
    }
    return this.service.findAll(query);
  }

  /**
   * GET /invoices/:id
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const invoice = await this.service.findById(id);
    // Клиент видит только свои инвойсы
    if (!user.isManager && invoice.companyId !== user.companyId) {
      throw new BadRequestException('Доступ запрещён');
    }
    return invoice;
  }

  /**
   * GET /invoices/:id/download-url
   * Presigned URL для скачивания PDF (действует 1 час).
   */
  @Get(':id/download-url')
  getDownloadUrl(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const companyId = user.isManager ? undefined : user.companyId;
    return this.service.getDownloadUrl(id, companyId ?? 0);
  }

  /**
   * GET /invoices/:id/delivery-status
   * Статус рассылки по трём каналам.
   */
  @Get(':id/delivery-status')
  @Roles(UserRole.MANAGER)
  getDeliveryStatus(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDeliveryStatus(id);
  }

  // ══════════════════════════════════════════════════════════════════════
  // МЕНЕДЖЕР: управление
  // ══════════════════════════════════════════════════════════════════════

  /**
   * PATCH /invoices/:id/status
   * Проставить статус оплаты: pending | paid | overdue | cancelled.
   */
  @Patch(':id/status')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceStatusDto,
    @CurrentUser() manager: User,
  ) {
    return this.service.updateStatus(id, manager.id, dto);
  }

  /**
   * POST /invoices/:id/resend
   * Повторная отправка по указанным (или всем упавшим) каналам.
   *
   * Body: { channels?: ['telegram_personal', 'email'] }
   */
  @Post(':id/resend')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async resend(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResendInvoiceDto,
    @CurrentUser() manager: User,
  ) {
    const invoice  = await this.service.findById(id);
    const contacts = await this.resolveContacts(invoice.companyId);

    return this.service.resend(id, manager.id, dto.channels, contacts);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Получить контакты клиента для рассылки.
   * TODO: заменить на реальный вызов CompanyService + UserService.
   */
  private async resolveContacts(companyId: number): Promise<ClientDeliveryContacts> {
    // ЗАГЛУШКА — в реальном коде:
    // const company = await this.companyService.findById(companyId);
    // const contact = await this.usersService.findPrimaryContact(companyId);
    // return {
    //   companyName:  company.name,
    //   contactName:  contact.displayName,
    //   telegramId:   contact.telegramId,
    //   groupChatId:  company.groupChatId,
    //   email:        company.invoiceEmail,
    // };
    return {
      companyName:  `Company #${companyId}`,
      contactName:  'Client',
      telegramId:   '', // REPLACE: contact.telegramId
      groupChatId:  null, // REPLACE: company.groupChatId
      email:        null, // REPLACE: company.invoiceEmail
    };
  }
}
