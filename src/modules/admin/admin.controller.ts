import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotImplementedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get platform analytics (not implemented)' })
  @ApiUnauthorizedResponse({
    description: 'Admin authentication and authorization are not configured.',
  })
  @ApiNotImplementedResponse({
    description: 'Analytics are not implemented yet.',
  })
  getAnalytics(): never {
    return this.adminService.getAnalytics();
  }
}
