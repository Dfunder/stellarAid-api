import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import {
  ChecklistItemDto,
  RequestRevisionDto,
  SetDeliveryDateDto,
  SubmitCommissionRequestDto,
  ToggleChecklistDto,
} from './dto/commission-request.dto';
import { CommissionRequestsService } from './commission-requests.service';

@ApiTags('commission-requests')
@Controller({ version: '1', path: 'commission-requests' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommissionRequestsController {
  constructor(private readonly service: CommissionRequestsService) {}

  @Post()
  @Roles(Role.CLIENT, Role.BUSINESS)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a commission request with checklist' })
  async submit(
    @CurrentUser() user: { sub: string },
    @Body() dto: SubmitCommissionRequestDto,
  ) {
    return this.service.submitRequest(user.sub, dto);
  }

  @Post(':id/revisions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a revision with feedback (client)' })
  async requestRevision(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
  ) {
    return this.service.requestRevision(user.sub, id, dto.feedback);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'List revision requests for a commission' })
  async listRevisions(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.service.listRevisions(user.sub, id);
  }

  @Patch('revisions/:revisionId/addressed')
  @ApiOperation({ summary: 'Mark a revision addressed (artist)' })
  async addressed(
    @CurrentUser() user: { sub: string },
    @Param('revisionId') revisionId: string,
  ) {
    return this.service.markRevisionAddressed(user.sub, revisionId);
  }

  @Post(':id/checklist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a completion-checklist item (artist)' })
  async addChecklist(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: ChecklistItemDto,
  ) {
    return this.service.addChecklistItem(user.sub, id, dto.label);
  }

  @Get(':id/checklist')
  @ApiOperation({ summary: 'Get the completion checklist' })
  async getChecklist(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.service.getChecklist(user.sub, id);
  }

  @Patch('checklist/:itemId')
  @ApiOperation({ summary: 'Toggle a checklist item (artist)' })
  async toggleChecklist(
    @CurrentUser() user: { sub: string },
    @Param('itemId') itemId: string,
    @Body() dto: ToggleChecklistDto,
  ) {
    return this.service.toggleChecklistItem(user.sub, itemId, dto.isDone);
  }

  @Patch(':id/delivery-date')
  @ApiOperation({ summary: 'Set the delivery date (artist)' })
  async setDelivery(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: SetDeliveryDateDto,
  ) {
    return this.service.setDeliveryDate(user.sub, id, dto.deliveryDueAt);
  }

  @Patch(':id/deliver')
  @ApiOperation({ summary: 'Mark work delivered (artist)' })
  async deliver(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.service.markDelivered(user.sub, id);
  }

  @Patch(':id/verify-delivery')
  @ApiOperation({
    summary: 'Verify delivery, completing the commission (client)',
  })
  async verify(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.service.verifyDelivery(user.sub, id);
  }
}
