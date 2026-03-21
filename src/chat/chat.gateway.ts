import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket }   from 'socket.io';

import { ChatService }   from './chat.service';
import { AiService }     from './ai.service';
import { SenderType }    from './entities/chat-message.entity';
import { WsSendPayload, WsTypingPayload } from './dto/chat.dto';

// Упрощённый guard для WS — в продакшне использовать WsJwtGuard
// (извлекает JWT из handshake.auth.token)
import { JwtService }      from '@nestjs/jwt';
import { ConfigService }   from '@nestjs/config';
import { UsersService }    from '../users/users.service';

/**
 * ChatGateway — WebSocket сервер для чата.
 *
 * Подключение с клиента:
 *   const socket = io('wss://api.cleanshop.eu', {
 *     auth: { token: accessToken },
 *     path: '/socket.io',
 *   });
 *
 * События клиент → сервер:
 *   socket.emit('message:send',  { text, attachmentUrl? })
 *   socket.emit('message:typing', { isTyping: true })
 *   socket.emit('message:read',   { messageId })
 *
 * События сервер → клиент:
 *   socket.on('message:new',  handler)
 *   socket.on('message:typing', handler)
 *   socket.on('chat:status', handler)
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin:      '*', // в продакшне: ['https://web.telegram.org', ...]
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // companyId → Set<socketId>
  private readonly rooms = new Map<number, Set<string>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly aiService:   AiService,
    private readonly jwt:         JwtService,
    private readonly config:      ConfigService,
    private readonly users:       UsersService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // CONNECTION LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token   = socket.handshake.auth?.token as string;
      const payload = this.jwt.verify<{ sub: number }>(token, {
        secret: this.config.getOrThrow('JWT_SECRET'),
      });

      const user = await this.users.findById(payload.sub);
      if (!user || !user.isActive || !user.companyId) {
        socket.disconnect();
        return;
      }

      // Аттачим данные к сокету
      socket.data.userId    = user.id;
      socket.data.companyId = user.companyId;
      socket.data.isManager = user.isManager;
      socket.data.name      = user.displayName;

      // Присоединяем к комнате компании
      const room = `company:${user.companyId}`;
      await socket.join(room);

      if (!this.rooms.has(user.companyId)) {
        this.rooms.set(user.companyId, new Set());
      }
      this.rooms.get(user.companyId)!.add(socket.id);

      // Отправляем текущий статус чата
      socket.emit('chat:status', this.aiService.getChatStatus());

      this.logger.log(
        `WS connect: user=${user.id} company=${user.companyId} socket=${socket.id}`,
      );
    } catch {
      this.logger.warn(`WS: отклонён неавторизованный сокет ${socket.id}`);
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket): void {
    const companyId = socket.data?.companyId;
    if (companyId) {
      this.rooms.get(companyId)?.delete(socket.id);
    }
    this.logger.log(`WS disconnect: socket=${socket.id}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Клиент отправляет сообщение.
   */
  @SubscribeMessage('message:send')
  async onMessageSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: WsSendPayload,
  ): Promise<void> {
    const { userId, companyId, name } = socket.data;

    if (!companyId || !userId) return;

    // Текущий контекст клиента — в продакшне загружать из OrdersService
    const ctx = await this.buildClientContext(companyId, name);

    // Показываем typing от имени ИИ/менеджера
    const status = this.aiService.getChatStatus();
    const agentName = status.mode === 'ai' ? 'ИИ-ассистент' : (status.agentName ?? 'Менеджер');

    this.broadcastToCompany(companyId, 'message:typing', {
      isTyping:   true,
      senderType: status.mode === 'ai' ? SenderType.AI : SenderType.MANAGER,
      senderName: agentName,
    });

    try {
      const { clientMsg, replyMsg } = await this.chatService.handleClientMessage(
        companyId,
        userId,
        payload.text,
        ctx,
        payload.attachmentUrl ?? null,
      );

      // Рассылаем сообщение клиента всем в комнате
      this.broadcastToCompany(companyId, 'message:new',
        this.chatService.toWsEvent(clientMsg, name).data
      );

      // Если есть ответ ИИ — рассылаем его
      if (replyMsg) {
        // Сначала убираем typing
        this.broadcastToCompany(companyId, 'message:typing', {
          isTyping: false, senderType: SenderType.AI, senderName: agentName,
        });

        this.broadcastToCompany(companyId, 'message:new',
          this.chatService.toWsEvent(replyMsg, agentName).data
        );
      }
    } catch (err) {
      this.logger.error(`WS message:send error: ${err.message}`);
      // Убираем typing при ошибке
      this.broadcastToCompany(companyId, 'message:typing', {
        isTyping: false, senderType: SenderType.AI, senderName: agentName,
      });
    }
  }

  /**
   * Индикатор печати.
   */
  @SubscribeMessage('message:typing')
  onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: WsTypingPayload,
  ): void {
    const { companyId, name, isManager } = socket.data;
    if (!companyId) return;

    // Рассылаем другим участникам комнаты (не себе)
    socket.to(`company:${companyId}`).emit('message:typing', {
      isTyping:   payload.isTyping,
      senderType: isManager ? SenderType.MANAGER : SenderType.CLIENT,
      senderName: name,
    });
  }

  /**
   * Отметить сообщение прочитанным.
   */
  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { messageId: string },
  ): Promise<void> {
    const { companyId } = socket.data;
    if (!companyId) return;

    await this.chatService.markRead(companyId, payload.messageId);

    // Уведомляем менеджеров о прочтении
    socket.to(`company:${companyId}`).emit('message:read', {
      messageId: payload.messageId,
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC — вызывается из ChatController (REST → WS push)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Отправить сообщение менеджера из REST-запроса в WS-комнату.
   */
  broadcastManagerMessage(
    companyId:   number,
    managerName: string,
    text:        string,
    cardPayload: Record<string, unknown> | null = null,
  ): void {
    this.broadcastToCompany(companyId, 'message:new', {
      senderType: SenderType.MANAGER,
      senderName: managerName,
      text,
      cardPayload,
      attachmentUrl: null,
      createdAt: new Date().toISOString(),
    });
  }

  /** Обновить статус чата для всей комнаты компании. */
  broadcastStatusUpdate(companyId: number): void {
    const status = this.aiService.getChatStatus();
    this.broadcastToCompany(companyId, 'chat:status', status);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ══════════════════════════════════════════════════════════════════════

  private broadcastToCompany(companyId: number, event: string, data: unknown): void {
    this.server.to(`company:${companyId}`).emit(event, data);
  }

  /**
   * Построить контекст клиента для system prompt.
   * В продакшне: загружать из OrdersService, InvoicesService.
   */
  private async buildClientContext(
    companyId: number,
    contactName: string,
  ): Promise<import('./prompts/system-prompt').ClientContext> {
    // TODO: заменить на реальные данные из OrdersService / InvoicesService
    return {
      companyName:     `Company #${companyId}`,
      contactName,
      languageCode:    'en',
      activeOrders:    [],
      pendingPallets:  0,
      pendingInvoices: 0,
      recentProducts:  [],
    };
  }
}
