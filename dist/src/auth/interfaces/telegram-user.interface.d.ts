export interface TelegramUser {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
}
export interface ParsedInitData {
    user: TelegramUser;
    auth_date: number;
    hash: string;
    chat_type?: string;
    start_param?: string;
}
