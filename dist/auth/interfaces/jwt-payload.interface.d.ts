import { UserRole } from '../../users/user.entity';
export interface JwtPayload {
    sub: number;
    tid: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
