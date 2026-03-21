import {
  IsString, IsOptional, IsInt, IsPositive,
  IsIn, Min, Max, IsArray, ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PalletStatus } from '../entities/pallet.entity';

// ── Создать паллету ──────────────────────────────────────────────────────────
export class CreatePalletDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number; // если уже привязана к заказу
}

// ── Обновить паллету ─────────────────────────────────────────────────────────
export class UpdatePalletDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  truckId?: number | null; // null = убрать из фуры
}

// ── Добавить позицию в паллету ───────────────────────────────────────────────
export class AddPalletItemDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  productId: number;

  @IsInt()
  @Min(1)
  @Max(10_000)
  @Type(() => Number)
  boxes: number;
}

// ── Изменить количество в позиции ────────────────────────────────────────────
export class UpdatePalletItemDto {
  @IsInt()
  @Min(1)
  @Max(10_000)
  @Type(() => Number)
  boxes: number;
}

// ── Назначить паллеты в фуру (batch) ─────────────────────────────────────────
export class AssignPalletsToTruckDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @Type(() => Number)
  palletIds: number[];
}

// ── Фильтрация при запросе списка паллет ─────────────────────────────────────
export class PalletQueryDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  orderId?: number;

  @IsOptional()
  @IsIn(Object.values(PalletStatus))
  status?: PalletStatus;
}
