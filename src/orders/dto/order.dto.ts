// src/orders/dto/order.dto.ts
import {
  IsDateString, IsInt, IsOptional, IsPositive,
  IsString, MaxLength, IsEnum, IsIn, Min, Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderStatus, TruckType } from '../entities/order.entity';

// ── Создать заказ (черновик) ─────────────────────────────────────────────────
export class CreateOrderDto {
  @IsOptional()
  @IsDateString()
  proposedDate?: string; // YYYY-MM-DD

  @IsOptional()
  @IsEnum(TruckType)
  truckType?: TruckType; // small_5t | large_24t

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  truckCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// ── Отправить черновик менеджеру (клиент, без даты) ─────────────────────────
export class SubmitOrderDto {}

// ── Предложить / изменить дату погрузки (клиент) ────────────────────────────
export class ProposeDateDto {
  @IsDateString()
  proposedDate: string; // YYYY-MM-DD
}

// ── Подтвердить дату погрузки (менеджер) ─────────────────────────────────────
export class ConfirmDateDto {
  @IsDateString()
  confirmedDate: string; // YYYY-MM-DD — может отличаться от предложенной

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  truckCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

// ── Подтвердить план паллет (клиент) ─────────────────────────────────────────
export class ConfirmPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

// ── Отменить заказ (менеджер/admin) ──────────────────────────────────────────
export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ── Отметить отгрузку (менеджер) ─────────────────────────────────────────────
export class ShipOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

// ── Обновить заметки/количество фур (менеджер) ───────────────────────────────
export class UpdateOrderDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  truckCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// ── Query-параметры ───────────────────────────────────────────────────────────
export class OrderQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  companyId?: number;

  /** Показать только заказы у которых окно паллет скоро закроется */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  urgentOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
