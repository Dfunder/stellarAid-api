import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { InitiateEscrowDto } from './dto/initiate-escrow.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import {
  ConfirmPaymentResponse,
  InitiateEscrowResponse,
  ReleasePaymentResponse,
} from './ro/payments.ro';
import type { Request } from 'express';

@ApiTags('payments')
@Controller({ version: '1', path: 'payments' })
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  // Initiate escrow endpoint
  @Post('commissions/:id/escrow')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate escrow payment for a commission' })
  @ApiParam({ name: 'id', description: 'Commission ID' })
  @ApiBody({
    type: InitiateEscrowDto,
    examples: {
      a: {
        summary: 'Initiate escrow for a commission',
        value: {
          clientWallet:
            'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
          amount: 100,
          assetCode: 'XLM',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Escrow initiated, returns unsigned XDR for client signing',
    type: InitiateEscrowResponse,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Commission not found' })
  async initiateEscrow(
    @Req() req: Request,
    @Param('id') commissionId: string,
    @Body() dto: InitiateEscrowDto,
  ) {
    return this.paymentsService.initiateEscrow(commissionId, dto);
  }
  // Confirm payment endpoint
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit signed XDR to confirm a payment' })
  @ApiBody({
    type: ConfirmPaymentDto,
    examples: {
      a: {
        summary: 'Confirm a payment',
        value: {
          paymentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          signedXdr: 'AAAAAgAAAAC5kL34KjY9...SIGNED_XDR...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed and commission moved to IN_PROGRESS',
    type: ConfirmPaymentResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Transaction failed or payment not in PENDING state',
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async confirmPayment(@Req() req: Request, @Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirmPayment(dto);
  }

  @Post('commissions/:id/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release escrowed payment to artist' })
  @ApiParam({ name: 'id', description: 'Commission ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment released to artist, platform fee deducted',
    type: ReleasePaymentResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Commission not COMPLETED or artist has no wallet',
  })
  @ApiResponse({
    status: 404,
    description: 'Commission or confirmed payment not found',
  })
  async releasePayment(@Req() req: Request, @Param('id') commissionId: string) {
    return this.paymentsService.releasePayment(commissionId);
  }
}
