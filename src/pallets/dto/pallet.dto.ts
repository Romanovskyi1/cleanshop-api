import {
  IsString, IsOptional, IsInt, IsPositive,
  IsIn, Min, IsArray, ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PalletStatus } from '../entities/pallet.entity';

// ── Создать паллету (низкоуровневое, без авто-консолидации) ──────────────────
export class CreatePalletDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  productId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  palletsCount?: number;
}

// ── Обновить паллету ─────────────────────────────────────────────────────────
export class UpdatePalletDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  truckId?: number | null;

  /** 0 → удалить паллету. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  palletsCount?: number;
}

// ── Добавить паллеты SKU в заказ (с авто-консолидацией) ──────────────────────
export class AddPalletsDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  productId: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  palletsCount: number;
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
