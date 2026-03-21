import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard проверяет, что у пользователя есть нужная роль.
 * Используется совместно с @Roles('manager') или @Roles('admin').
 *
 * Пример:
 *   @Roles(UserRole.MANAGER)
 *   @Get('/orders')
 *   getOrders() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Если @Roles не указан — пропускаем (роль не важна, только авторизация)
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException();

    const hasRole = required.some((role) => {
      if (role === UserRole.ADMIN)   return user.role === UserRole.ADMIN;
      if (role === UserRole.MANAGER) return user.isManager; // manager + admin
      return true; // client
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `Доступ запрещён. Требуется роль: ${required.join(' или ')}`,
      );
    }

    return true;
  }
}
