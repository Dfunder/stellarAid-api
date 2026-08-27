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
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import {
  BulkNotificationDto,
  CreateNotificationDto,
  QueryNotificationsDto,
  SendFromTemplateDto,
  UpdatePreferencesDto,
  UpsertTemplateDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller({ version: '1', path: 'notifications' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  async list(
    @CurrentUser() user: { sub: string },
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.listForUser(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count my unread notifications' })
  async unread(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications read' })
  async readAll(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification read' })
  async read(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notificationsService.markRead(user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notificationsService.remove(user.sub, id);
  }

  // --- Preferences ---------------------------------------------------------

  @Get('preferences')
  @ApiOperation({ summary: 'Get my notification preferences' })
  async getPreferences(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update my notification preferences' })
  async updatePreferences(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.sub, dto);
  }

  // --- Admin: bulk, templates, scheduling, analytics -----------------------

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a notification for a user (admin)' })
  async create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post('bulk')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a notification to many users (admin)' })
  async bulk(@Body() dto: BulkNotificationDto) {
    return this.notificationsService.bulkSend(dto);
  }

  @Post('templates')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create or update a notification template (admin)' })
  async upsertTemplate(@Body() dto: UpsertTemplateDto) {
    return this.notificationsService.upsertTemplate(dto);
  }

  @Get('templates')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List notification templates (admin)' })
  async listTemplates() {
    return this.notificationsService.listTemplates();
  }

  @Post('templates/send')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a notification from a template (admin)' })
  async sendFromTemplate(@Body() dto: SendFromTemplateDto) {
    return this.notificationsService.sendFromTemplate(dto);
  }

  @Post('process-scheduled')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dispatch due scheduled notifications (admin/cron)',
  })
  async processScheduled() {
    return this.notificationsService.processScheduled();
  }

  @Get('analytics')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Notification delivery analytics (admin)' })
  async analytics() {
    return this.notificationsService.analytics();
  }
}
