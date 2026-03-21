import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class TelegramAuthDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  initData: string; // сырая строка initData из window.Telegram.WebApp.initData
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
