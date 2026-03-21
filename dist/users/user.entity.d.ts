export declare enum UserRole {
    CLIENT = "client",
    MANAGER = "manager",
    ADMIN = "admin"
}
export declare class User {
    id: number;
    telegramId: string;
    username: string;
    firstName: string;
    lastName: string;
    languageCode: string;
    companyId: number;
    role: UserRole;
    gdprConsentAt: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    get isManager(): boolean;
    get isAdmin(): boolean;
    get displayName(): string;
}
