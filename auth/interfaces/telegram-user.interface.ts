/**
 * Структура объекта user внутри Telegram initData.
 * Документация: https://core.telegram.org/bots/webapps#webappuser
 */
export interface TelegramUser {
  id:            number;
  is_bot?:       boolean;
  first_name:    string;
  last_name?:    string;
  username?:     string;
  language_code?: string;
  is_premium?:   boolean;
  photo_url?:    string;
}

/**
 * Разобранный и верифицированный initData из Telegram WebApp.
 */
export interface ParsedInitData {
  user:       TelegramUser;
  auth_date:  number;   // Unix timestamp
  hash:       string;
  chat_type?: string;
  start_param?: string;
}
