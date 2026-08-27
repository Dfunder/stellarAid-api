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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller({ version: '1', path: 'projects' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('commissions/:commissionId/milestones')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a milestone (artist)' })
  async create(
    @CurrentUser() user: { sub: string },
    @Param('commissionId') commissionId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projectsService.create(user.sub, commissionId, dto);
  }

  @Get('commissions/:commissionId/milestones')
  @ApiOperation({ summary: 'List milestones for a commission' })
  async list(
    @CurrentUser() user: { sub: string },
    @Param('commissionId') commissionId: string,
  ) {
    return this.projectsService.list(user.sub, commissionId);
  }

  @Get('commissions/:commissionId/progress')
  @ApiOperation({ summary: 'Milestone progress & timeline data' })
  async progress(
    @CurrentUser() user: { sub: string },
    @Param('commissionId') commissionId: string,
  ) {
    return this.projectsService.progress(user.sub, commissionId);
  }

  @Patch('milestones/:id')
  @ApiOperation({ summary: 'Update a milestone (artist)' })
  async update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.projectsService.update(user.sub, id, dto);
  }

  @Patch('milestones/:id/submit')
  @ApiOperation({ summary: 'Submit a milestone for review (artist)' })
  async submit(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.projectsService.submit(user.sub, id);
  }

  @Patch('milestones/:id/approve')
  @ApiOperation({ summary: 'Approve/verify a milestone (client)' })
  async approve(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.projectsService.approve(user.sub, id);
  }

  @Patch('milestones/:id/release-payment')
  @ApiOperation({ summary: 'Release milestone-based payment (client)' })
  async release(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.projectsService.releasePayment(user.sub, id);
  }

  @Delete('milestones/:id')
  @ApiOperation({ summary: 'Delete a milestone (artist)' })
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.projectsService.remove(user.sub, id);
  }
}
