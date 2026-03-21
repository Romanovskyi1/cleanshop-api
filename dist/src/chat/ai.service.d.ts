import { ConfigService } from '@nestjs/config';
import { ParsedAiResponse } from './dto/chat.dto';
import { ClientContext } from './prompts/system-prompt';
interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
}
export declare class AiService {
    private readonly config;
    private readonly logger;
    private readonly claude;
    private readonly model;
    constructor(config: ConfigService);
    chat(userMessage: string, history: HistoryMessage[], ctx: ClientContext): Promise<ParsedAiResponse>;
    parseResponse(raw: string): ParsedAiResponse;
    isAiMode(): boolean;
    getChatStatus(): {
        mode: 'ai' | 'human';
        agentName?: string;
    };
    private getCETOffset;
    private lastSunday;
    private getFallbackText;
}
export {};
