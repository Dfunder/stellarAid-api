import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import {
  CreateConversationDto,
  SearchMessagesDto,
  SendMessageDto,
  UpdateMessageDto,
} from './dto/messaging.dto';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@Controller({ version: '1', path: 'messaging' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a conversation' })
  async createConversation(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagingService.createConversation(user.sub, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List my conversations (inbox)' })
  async listConversations(@CurrentUser() user: { sub: string }) {
    return this.messagingService.listConversations(user.sub);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation (threaded)' })
  async getMessages(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagingService.getMessages(
      user.sub,
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message (notifies other participants)' })
  async send(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(user.sub, id, dto);
  }

  @Patch('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark received messages in a conversation as read' })
  async markRead(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.messagingService.markRead(user.sub, id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Total unread messages for the caller' })
  async unread(@CurrentUser() user: { sub: string }) {
    return this.messagingService.unreadCount(user.sub);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search my messages by content' })
  async search(
    @CurrentUser() user: { sub: string },
    @Query() dto: SearchMessagesDto,
  ) {
    return this.messagingService.search(user.sub, dto);
  }

  @Patch('messages/:messageId')
  @ApiOperation({ summary: 'Edit one of my messages' })
  async update(
    @CurrentUser() user: { sub: string },
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messagingService.updateMessage(
      user.sub,
      messageId,
      dto.content,
    );
  }

  @Delete('messages/:messageId')
  @ApiOperation({ summary: 'Delete one of my messages' })
  async remove(
    @CurrentUser() user: { sub: string },
    @Param('messageId') messageId: string,
  ) {
    return this.messagingService.deleteMessage(user.sub, messageId);
  }
}
