import {
  Controller,
  Get,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { sendSuccess, sendError } from '../utils/response.util';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get('me/kyc')
  async getKycStatus(
    @CurrentUser() currentUser: JwtPayload,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const user = await this.usersService.findById(currentUser.sub);
      if (!user) {
        return sendError(res, 'User not found', HttpStatus.NOT_FOUND);
      }

      if (!user.kycSubmissionDate) {
        return sendError(res, 'No KYC submission found', HttpStatus.NOT_FOUND);
      }

      return sendSuccess(
        res,
        {
          status: user.kycStatus,
          submissionDate: user.kycSubmissionDate,
          reviewNotes: user.kycReviewNotes,
        },
        'KYC status retrieved successfully',
      );
    } catch (err) {
      return sendError(
        res,
        'Failed to retrieve KYC status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
