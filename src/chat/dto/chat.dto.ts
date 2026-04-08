import { IsString, IsNotEmpty, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { SenderType, MessageIntent } from '../entities/chat-message.entity';

// ── REST DTO ─────────────────────────────────────────────────────────────────

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;
}

export class GetMessagesDto {
  /** Курсор для пагинации назад — ID последнего известного сообщения */
  before?: string;

  /** Лимит — дефолт 50 */
  limit?: number;
}

// ── WebSocket events (server → client) ──────────────────────────────────────

export interface WsMessageEvent {
  event: 'message:new';
  data: {
    id:           string;
    senderType:   SenderType;
    senderName:   string;
    text:         string;
    cardPayload:  Record<string, unknown> | null;
    attachmentUrl: string | null;
    createdAt:    string;
  };
}

export interface WsTypingEvent {
  event: 'message:typing';
  data: {
    isTyping:   boolean;
    senderType: SenderType;
    senderName: string;
  };
}

export interface WsStatusEvent {
  event: 'chat:status';
  data: {
    mode:       'ai' | 'human';
    agentName?: string;
    onlineAt?:  string; // рабочие часы по CET
  };
}

export interface WsReadEvent {
  event: 'message:read';
  data: { messageId: string };
}

// ── WebSocket events (client → server) ──────────────────────────────────────

export class WsSendPayload {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;
}

export interface WsTypingPayload {
  isTyping: boolean;
}

// ── Parsed AI response ────────────────────────────────────────────────────────

export interface ParsedAiResponse {
  text:         string;                           // очищенный текст без JSON-блоков
  intent:       MessageIntent;
  confidence:   number;
  cardPayload:  Record<string, unknown> | null;
  escalation:   { reason: string; urgency: 'normal' | 'high' | 'critical' } | null;
}
