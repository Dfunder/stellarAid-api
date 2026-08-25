import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: PortfolioAnalyticsService) {}

  @Get('portfolios/:id')
  @ApiOperation({ summary: 'Get portfolio analytics (owner only)' })
  @ApiResponse({ status: 200, description: 'Portfolio analytics' })
  @ApiResponse({ status: 403, description: 'Portfolio owner required' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  getPortfolioAnalytics(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.analytics.getAnalytics(id, user.sub);
  }
}
