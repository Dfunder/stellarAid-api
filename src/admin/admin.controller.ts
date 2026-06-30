import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { sendError, sendSuccess } from '../utils/response.util';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { KycReviewStatus } from '../kyc/schemas/kyc.schema';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Existing: DELETE /api/admin/users/:id
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Res() res: Response,
  ): Promise<Response> {
    if (currentUser.sub === id) {
      return sendError(res, 'Admins cannot delete their own account', HttpStatus.FORBIDDEN);
    }
    try {
      await this.adminService.softDelete(id);
      return sendSuccess(res, null, 'User account deleted successfully', HttpStatus.OK);
    } catch (err) {
      if (err instanceof NotFoundException) return sendError(res, err.message, HttpStatus.NOT_FOUND);
      if (err instanceof ForbiddenException) return sendError(res, err.message, HttpStatus.FORBIDDEN);
      throw err;
    }
  }

  // #386: PATCH /api/admin/users/:id/role
  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() currentUser: JwtPayload,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const user = await this.adminService.updateRole(id, dto.role, currentUser.sub);
      return sendSuccess(res, user, 'User role updated successfully');
    } catch (err) {
      if (err instanceof NotFoundException) return sendError(res, err.message, HttpStatus.NOT_FOUND);
      if (err instanceof ForbiddenException) return sendError(res, err.message, HttpStatus.FORBIDDEN);
      throw err;
    }
  }

  // #391: PATCH /api/admin/users/:id/status
  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() currentUser: JwtPayload,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const user = await this.adminService.updateStatus(id, dto.status, currentUser.sub);
      return sendSuccess(res, user, 'User status updated successfully');
    } catch (err) {
      if (err instanceof NotFoundException) return sendError(res, err.message, HttpStatus.NOT_FOUND);
      if (err instanceof ForbiddenException) return sendError(res, err.message, HttpStatus.FORBIDDEN);
      throw err;
    }
  }

  // #392: PATCH /api/admin/kyc/:id
  @Patch('kyc/:id')
  @HttpCode(HttpStatus.OK)
  async reviewKyc(
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const kyc = await this.adminService.reviewKyc(id, dto.status, dto.reviewNote);
      return sendSuccess(res, kyc, 'KYC submission reviewed successfully');
    } catch (err) {
      if (err instanceof NotFoundException) return sendError(res, err.message, HttpStatus.NOT_FOUND);
      throw err;
    }
  }

  // #393: GET /api/admin/kyc
  @Get('kyc')
  @HttpCode(HttpStatus.OK)
  async listKyc(
    @Query('status') status: KycReviewStatus | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    const validStatuses = Object.values(KycReviewStatus) as string[];
    if (status && !validStatuses.includes(status)) {
      return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, HttpStatus.BAD_REQUEST);
    }
    const submissions = await this.adminService.listKyc(status);
    return sendSuccess(res, submissions, 'KYC submissions retrieved successfully');
  }
}
