import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommissionsService } from './commissions.service';
import { RejectCommissionDto } from './dto/accept-reject.dto';
import {
  RequestRevisionDto,
  SubmitCommissionDto,
} from './dto/submit-revision.dto';
import { CreateMilestonesDto } from './dto/milestone.dto';

@ApiTags('commissions')
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Artist accepts commission' })
  @ApiResponse({ status: 200, description: 'Commission accepted, conversation created' })
  async accept(@Param('id') id: string, @Req() req: any) {
    return this.commissionsService.accept(id, req.user.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Artist rejects commission' })
  @ApiResponse({ status: 200, description: 'Commission rejected' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectCommissionDto,
    @Req() req: any,
  ) {
    return this.commissionsService.reject(id, req.user.id, dto);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Artist submits deliverables' })
  @ApiResponse({ status: 200, description: 'Commission submitted for review' })
  async submit(
    @Param('id') id: string,
    @Body() dto: SubmitCommissionDto,
    @Req() req: any,
  ) {
    return this.commissionsService.submit(id, req.user.id, dto);
  }

  @Patch(':id/request-revision')
  @ApiOperation({ summary: 'Client requests revision' })
  @ApiResponse({ status: 200, description: 'Revision requested' })
  async requestRevision(
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
    @Req() req: any,
  ) {
    return this.commissionsService.requestRevision(id, req.user.id, dto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Client approves commission' })
  @ApiResponse({ status: 200, description: 'Commission completed' })
  async approve(@Param('id') id: string, @Req() req: any) {
    return this.commissionsService.approve(id, req.user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel commission' })
  @ApiResponse({ status: 200, description: 'Commission cancelled or disputed' })
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.commissionsService.cancel(id, req.user.id);
  }

  @Post(':id/milestones')
  @ApiOperation({ summary: 'Create milestones for commission' })
  @ApiResponse({ status: 201, description: 'Milestones created' })
  async createMilestones(
    @Param('id') id: string,
    @Body() dto: CreateMilestonesDto,
    @Req() req: any,
  ) {
    return this.commissionsService.createMilestones(id, req.user.id, dto);
  }

  @Get(':id/milestones')
  @ApiOperation({ summary: 'List milestones for commission' })
  @ApiResponse({ status: 200, description: 'List of milestones' })
  async listMilestones(@Param('id') id: string) {
    return this.commissionsService.listMilestones(id);
  }

  @Patch(':id/milestones/:milestoneId/approve')
  @ApiOperation({ summary: 'Client approves a milestone' })
  @ApiResponse({ status: 200, description: 'Milestone approved' })
  async approveMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Req() req: any,
  ) {
    return this.commissionsService.approveMilestone(id, milestoneId, req.user.id);
  }
}
