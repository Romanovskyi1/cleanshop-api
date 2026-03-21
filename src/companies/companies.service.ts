// src/companies/companies.service.ts
import {
  Injectable, Logger, NotFoundException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }        from 'typeorm';

import { Company, InvoiceTerms } from './entities/company.entity';
import {
  CreateCompanyDto, UpdateCompanyDto,
  DeliveryContacts,
} from './dto/company.dto';

// Интерфейс User для разрыва циклической зависимости
// UsersModule не импортируется напрямую
export interface IUser {
  id:          number;
  telegramId:  string;
  firstName:   string;
  lastName:    string | null;
  displayName: string;
  companyId:   number | null;
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    @InjectRepository(Company)
    private readonly repo: Repository<Company>,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════════

  async findAll(): Promise<Company[]> {
    return this.repo.find({
      order: { name: 'ASC' },
    });
  }

  async findById(id: number): Promise<Company> {
    const company = await this.repo.findOne({ where: { id } });
    if (!company) throw new NotFoundException(`Компания #${id} не найдена`);
    return company;
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    // Проверяем уникальность VAT если передан
    if (dto.vatNumber) {
      const existing = await this.repo.findOne({ where: { vatNumber: dto.vatNumber } });
      if (existing) {
        throw new ConflictException(
          `Компания с VAT ${dto.vatNumber} уже существует (id=${existing.id})`,
        );
      }
    }

    const company = this.repo.create(dto);
    const saved   = await this.repo.save(company);
    this.logger.log(`Company created: id=${saved.id} name="${saved.name}"`);
    return saved;
  }

  async update(id: number, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findById(id);
    Object.assign(company, dto);
    const saved = await this.repo.save(company);
    this.logger.log(`Company updated: id=${id}`);
    return saved;
  }

  /**
   * Привязать Telegram-группу к компании.
   * Выделено в отдельный метод — это чувствительное действие
   * которое влияет на рассылку инвойсов.
   */
  async setGroupChat(id: number, chatId: string): Promise<Company> {
    this.validateGroupChatId(chatId);

    const company = await this.findById(id);
    company.telegramGroupChatId = chatId;
    const saved = await this.repo.save(company);

    this.logger.log(`Company #${id}: groupChatId set to ${chatId}`);
    return saved;
  }

  /**
   * Деактивировать компанию (soft delete).
   */
  async deactivate(id: number): Promise<Company> {
    const company = await this.findById(id);
    company.isActive = false;
    return this.repo.save(company);
  }

  // ══════════════════════════════════════════════════════════════════════
  // КЛЮЧЕВОЙ МЕТОД: resolveDeliveryContacts
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Собрать все контакты для рассылки инвойса.
   *
   * Заменяет заглушку resolveContacts() в InvoicesController.
   *
   * @param companyId — ID компании-получателя
   * @param contact   — основной контакт (User) — передаётся из UsersService
   *                    чтобы не создавать циклическую зависимость
   * @param issuedAt  — дата выставления инвойса (для расчёта due date)
   */
  async resolveDeliveryContacts(
    companyId: number,
    contact:   IUser,
    issuedAt:  Date,
  ): Promise<DeliveryContacts> {
    const company = await this.findById(companyId);

    const contactName = company.primaryContactName
      ?? contact.displayName
      ?? `${contact.firstName} ${contact.lastName ?? ''}`.trim();

    return {
      companyName:  company.name,
      contactName,
      telegramId:   contact.telegramId,           // личный чат клиента
      groupChatId:  company.telegramGroupChatId,  // групповой чат (может быть null)
      email:        company.invoiceEmail,          // email (может быть null)
      vatRate:      Number(company.vatRate),
      invoiceTerms: company.invoiceTerms,
      dueDateStr:   company.calcDueDateStr(issuedAt),
    };
  }

  /**
   * Получить VAT-ставку компании.
   * Используется при генерации инвойса для расчёта суммы НДС.
   */
  async getVatRate(companyId: number): Promise<number> {
    const company = await this.findById(companyId);
    return Number(company.vatRate);
  }

  /**
   * Получить invoice terms компании.
   */
  async getInvoiceTerms(companyId: number): Promise<InvoiceTerms> {
    const company = await this.findById(companyId);
    return company.invoiceTerms;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Telegram supergroup ID начинается с -100.
   * Regular group — просто отрицательное число.
   */
  private validateGroupChatId(chatId: string): void {
    const n = Number(chatId);
    if (isNaN(n) || n >= 0) {
      throw new BadRequestException(
        `Некорректный Telegram group chat ID: "${chatId}". ` +
        'Должен быть отрицательным числом, например: -1001234567890',
      );
    }
  }
}
