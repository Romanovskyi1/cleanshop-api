import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { JwtModule }       from '@nestjs/jwt';
import { ConfigModule }    from '@nestjs/config';

import { ChatMessage }     from './entities/chat-message.entity';
import { ChatService }     from './chat.service';
import { ChatGateway }     from './chat.gateway';
import { ChatController }  from './chat.controller';
import { AiService }       from './ai.service';
import { UsersModule }     from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ChatMessage]),
    JwtModule.register({}), // секрет через ConfigService в AiService/Gateway
    UsersModule,
  ],
  controllers: [ChatController],
  providers:   [ChatService, ChatGateway, AiService],
  exports:     [ChatService, AiService],
})
export class ChatModule {}
