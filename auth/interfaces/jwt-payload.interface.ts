import { UserRole } from '../../users/user.entity';

/**
 * Payload JWT access-токена.
 */
export interface JwtPayload {
  sub:  number;      // users.id
  tid:  string;      // telegram_id (для быстрой идентификации без JOIN)
  role: UserRole;
  iat?: number;
  exp?: number;
}
