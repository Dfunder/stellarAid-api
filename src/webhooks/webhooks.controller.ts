import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RegisterWebhookDto, PublishWebhookEventDto } from './dto/webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller({ version: '1', path: 'webhooks' })
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Register an outgoing webhook endpoint' })
  register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterWebhookDto) {
    return this.service.register(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.service.list(user.sub);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.remove(user.sub, id);
  }

  @Post('events')
  @ApiOperation({ summary: 'Queue an event for matching registered endpoints' })
  publish(@CurrentUser() user: JwtPayload, @Body() dto: PublishWebhookEventDto) {
    return this.service.publish(user.sub, dto);
  }

  @Post('deliver')
  @ApiOperation({ summary: 'Process pending webhook deliveries' })
  deliver() {
    return this.service.deliverPending();
  }
}
