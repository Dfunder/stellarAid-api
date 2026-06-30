import {
  Controller,
  Post,
  UseGuards,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { KycService } from './kyc.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { sendError, sendSuccess } from '../utils/response.util';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_FILE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Controller('users/me/kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: './uploads/kyc',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (ALLOWED_FILE_TYPES.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Only ${ALLOWED_FILE_TYPES.join(', ')} files are allowed`), false);
        }
      },
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
    }),
  )
  async submitKyc(
    @CurrentUser() currentUser: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: SubmitKycDto,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      if (!file) {
        return sendError(res, 'Document file is required', HttpStatus.BAD_REQUEST);
      }

      const documentUrl = `/uploads/kyc/${file.filename}`;

      const kyc = await this.kycService.create(
        currentUser.sub,
        body.documentType,
        documentUrl,
      );

      return sendSuccess(
        res,
        kyc,
        'KYC document submitted successfully. Awaiting admin review.',
        HttpStatus.CREATED,
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        return sendError(res, err.message, HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }
}
