import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user.entity';

// ── @Public() ────────────────────────────────────────────────────────────────
// Пометить роут как публичный — JwtAuthGuard пропустит без проверки токена.
//
// Пример:
//   @Public()
//   @Post('/auth/telegram')
//   login(@Body() dto: TelegramAuthDto) { ... }

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// ── @Roles(...roles) ─────────────────────────────────────────────────────────
// Ограничить роут по роли. Используется совместно с RolesGuard.
//
// Пример:
//   @Roles(UserRole.MANAGER)
//   @Patch('/invoices/:id/status')
//   updateStatus() { ... }

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
