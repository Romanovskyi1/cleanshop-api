import {
  Injectable, Logger, NotFoundException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }        from 'typeorm';

import {
  Invoice, InvoiceStatus, DeliveryChannel,
} from './entities/invoice.entity';
import {
  UploadInvoiceDto, UpdateInvoiceStatusDto,
  InvoiceQueryDto, DistributionResult,
} from './dto/invoice.dto';
import { InvoiceDistributionService, ClientDeliveryContacts } from './invoice-distribution.service';
import { S3StorageService } from './channels/s3-storage.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,

    private readonly distribution: InvoiceDistributionService,
    private readonly s3:           S3StorageService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // ЗАГРУЗКА И РАССЫЛКА — основной flow
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Менеджер загружает PDF и запускает автораздачу.
   *
   * Flow:
   *  1. Принять PDF-файл (Buffer из Multer)
   *  2. Сохранить метаданные инвойса в БД
   *  3. Загрузить PDF в S3/R2
   *  4. Параллельно разослать по каналам
   *  5. Обновить pdfUrl в БД
   *  6. Вернуть итог рассылки
   */
  async uploadAndDistribute(
    managerId:     number,
    dto:           UploadInvoiceDto,
    pdfBuffer:     Buffer,
    filename:      string,
    contacts:      ClientDeliveryContacts,
  ): Promise<{ invoice: Invoice; distribution: DistributionResult }> {

    // Проверяем дубликат номера
    const existing = await this.invoices.findOne({
      where: { invoiceNumber: dto.invoiceNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Инвойс ${dto.invoiceNumber} уже существует (id=${existing.id})`,
      );
    }

    // Сохраняем запись инвойса
    const invoice = await this.invoices.save(
      this.invoices.create({
        invoiceNumber: dto.invoiceNumber,
        orderId:       dto.orderId ?? null,
        companyId:     dto.companyId,
        issuedBy:      managerId,
        dueDate:       dto.dueDate,
        subtotalEur:   dto.subtotalEur,
        vatRate:       dto.vatRate,
        vatAmount:     dto.vatAmount ?? (dto.subtotalEur * dto.vatRate / 100),
        totalEur:      dto.totalEur ?? (dto.subtotalEur * (1 + dto.vatRate / 100)),
        status:        InvoiceStatus.PENDING,
      }),
    );

    this.logger.log(
      `Invoice #${invoice.id} (${invoice.invoiceNumber}) created by manager ${managerId}`,
    );

    // Определяем каналы
    const channels = this.resolveChannels(dto.channels, contacts);

    // Запускаем рассылку
    const result = await this.distribution.distribute(
      invoice,
      pdfBuffer,
      contacts,
      channels,
    );

    // Обновляем pdfUrl в БД
    await this.invoices.update(invoice.id, { pdfUrl: result.pdfUrl });
    invoice.pdfUrl = result.pdfUrl;

    return { invoice, distribution: result };
  }

  // ══════════════════════════════════════════════════════════════════════
  // ПОВТОРНАЯ РАССЫЛКА
  // ══════════════════════════════════════════════════════════════════════

  async resend(
    invoiceId: number,
    managerId: number,
    channels:  string[] | undefined,
    contacts:  ClientDeliveryContacts,
  ): Promise<DistributionResult> {
    const invoice = await this.findById(invoiceId);

    // Скачиваем PDF из S3
    const pdfBuffer = await this.s3.downloadPdf(invoice.invoiceNumber);

    const targetChannels = this.resolveChannels(channels, contacts);

    return this.distribution.resend(invoice, pdfBuffer, contacts, targetChannels);
  }

  // ══════════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════════

  async findAll(query: InvoiceQueryDto): Promise<Invoice[]> {
    const where: Partial<Invoice> = {};
    if (query.status)    where.status    = query.status;
    if (query.companyId) where.companyId = query.companyId;
    if (query.orderId)   where.orderId   = query.orderId;

    return this.invoices.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Invoice> {
    const inv = await this.invoices.findOne({ where: { id } });
    if (!inv) throw new NotFoundException(`Инвойс #${id} не найден`);
    return inv;
  }

  async findByCompany(companyId: number): Promise<Invoice[]> {
    return this.invoices.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Менеджер проставляет статус оплаты вручную.
   */
  async updateStatus(
    id:        number,
    managerId: number,
    dto:       UpdateInvoiceStatusDto,
  ): Promise<Invoice> {
    const invoice = await this.findById(id);

    const update: Partial<Invoice> = { status: dto.status };
    if (dto.status === InvoiceStatus.PAID && !invoice.paidAt) {
      update.paidAt = new Date();
    }

    await this.invoices.update(id, update);
    Object.assign(invoice, update);

    this.logger.log(
      `Invoice #${id} status → ${dto.status} by manager ${managerId}`,
    );
    return invoice;
  }

  /**
   * Получить статус рассылки.
   */
  async getDeliveryStatus(invoiceId: number) {
    await this.findById(invoiceId); // проверка существования
    return this.distribution.getDeliveryStatus(invoiceId);
  }

  /**
   * Presigned URL для скачивания PDF клиентом (действует 1 час).
   */
  async getDownloadUrl(invoiceId: number, companyId: number): Promise<string> {
    const invoice = await this.findById(invoiceId);

    if (invoice.companyId !== companyId) {
      throw new ForbiddenException('Доступ к инвойсу запрещён');
    }

    return this.s3.getPresignedUrl(invoice.invoiceNumber);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private resolveChannels(
    requested: string[] | undefined,
    contacts:  ClientDeliveryContacts,
  ): DeliveryChannel[] {
    const all = [
      DeliveryChannel.TELEGRAM_PERSONAL,
      DeliveryChannel.TELEGRAM_GROUP,
      DeliveryChannel.EMAIL,
    ];

    if (!requested || !requested.length) {
      // Автоматически убираем каналы без контактов
      return all.filter(ch => {
        if (ch === DeliveryChannel.TELEGRAM_PERSONAL) return !!contacts.telegramId;
        if (ch === DeliveryChannel.TELEGRAM_GROUP)    return !!contacts.groupChatId;
        if (ch === DeliveryChannel.EMAIL)             return !!contacts.email;
        return false;
      });
    }

    return requested
      .filter(c => Object.values(DeliveryChannel).includes(c as DeliveryChannel))
      .map(c => c as DeliveryChannel);
  }
}
