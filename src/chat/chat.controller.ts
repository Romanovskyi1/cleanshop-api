import {
  Controller, Get, Post, Patch,
  Body, Query, Param, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ChatService }   from './chat.service';
import { ChatGateway }   from './chat.gateway';
import { SendMessageDto, GetMessagesDto } from './dto/chat.dto';
import { CurrentUser }   from '../common/decorators/current-user.decorator';
import { Roles }         from '../common/decorators/roles.decorator';
import { User, UserRole } from '../users/user.entity';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly gateway:     ChatGateway,
  ) {}

  /**
   * GET /chat/messages
   * История сообщений (REST-fallback для первой загрузки страницы).
   */
  @Get('messages')
  getHistory(
    @CurrentUser() user: User,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('before') before?: string,
  ) {
    return this.chatService.getHistory(user.companyId, limit, before);
  }

  /**
   * GET /chat/status
   * Текущий режим: ai | human, имя агента.
   */
  @Get('status')
  getStatus() {
    return this.chatService.getChatStatus();
  }

  /**
   * POST /chat/messages
   * REST-вариант отправки (для клиентов без WS или для тестов).
   */
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @CurrentUser() user: User,
    @Body() dto: SendMessageDto,
  ) {
    // В REST-режиме контекст упрощённый
    const ctx = {
      companyName:     `Company #${user.companyId}`,
      contactName:     user.displayName,
      languageCode:    user.languageCode ?? 'en',
      activeOrders:    [],
      pendingPallets:  0,
      pendingInvoices: 0,
      recentProducts:  [],
    };

    const result = await this.chatService.handleClientMessage(
      user.companyId,
      user.id,
      dto.text,
      ctx,
      dto.attachmentUrl,
    );

    return {
      clientMessage: result.clientMsg,
      reply:         result.replyMsg,
      escalated:     result.shouldEscalate,
    };
  }

  /**
   * POST /chat/manager-reply
   * Менеджер отвечает через REST (из внутренней панели или Telegram-бота).
   * Ответ рассылается через WS всем клиентам в комнате.
   */
  @Post('manager-reply')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async managerReply(
    @CurrentUser() manager: User,
    @Body() dto: { companyId: number; text: string },
  ) {
    const msg = await this.chatService.saveManagerReply(
      dto.companyId,
      manager.id,
      dto.text,
    );

    // Push через WebSocket
    this.gateway.broadcastManagerMessage(
      dto.companyId,
      manager.displayName,
      dto.text,
    );

    return msg;
  }

  /**
   * PATCH /chat/messages/:id/read
   * Отметить как прочитанное (REST-вариант).
   */
  @Patch('messages/:id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @Param('id') messageId: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.markRead(user.companyId, messageId);
  }
}
