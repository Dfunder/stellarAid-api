import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { Response } from 'express';
import { sendSuccess } from '../utils/response.util';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  @Get('me')
  getMe(@Req() req: Request, @Res() res: Response) {
    return sendSuccess(res, req.user);
  }
}