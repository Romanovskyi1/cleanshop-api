import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/user.entity';

/**
 * Извлекает текущего аутентифицированного пользователя из request.
 *
 * Пример:
 *   @Get('/me')
 *   getMe(@CurrentUser() user: User) {
 *     return user;
 *   }
 *
 *   // Или только ID:
 *   @Get('/orders')
 *   getOrders(@CurrentUser('id') userId: number) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: User = request.user;
    return field ? user?.[field] : user;
  },
);
