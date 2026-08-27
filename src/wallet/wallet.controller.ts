import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';
import { WalletService } from './wallet.service';
import { ConnectWalletDto } from './dto';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ version: '1', path: 'wallet' })
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connect a Stellar wallet' })
  @ApiResponse({
    status: 200,
    description: 'Wallet connected successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid public key format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async connectWallet(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConnectWalletDto,
  ) {
    return this.walletService.connectWallet(user.sub, dto);
  }
}
