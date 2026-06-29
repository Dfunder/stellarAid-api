import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { extname } from 'path';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendSuccess } from '../utils/response.util';
import { ProjectOwnerGuard } from './guards/project-owner.guard';
import { ProjectOwnerOrAdminGuard } from './guards/project-owner-or-admin.guard';
import { KycApprovedGuard } from './guards/kyc-approved.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';

const COVER_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;
const MAX_DOCUMENTS = 5;

const allowedCoverImageMimes = ['image/jpeg', 'image/png'];
const allowedDocumentMimes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

function coverImageFileFilter(_req: any, file: Express.Multer.File, cb: any) {
  if (allowedCoverImageMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Only JPEG and PNG images are allowed'), false);
  }
}

function documentFileFilter(_req: any, file: Express.Multer.File, cb: any) {
  if (allowedDocumentMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        'Only PDF, DOCX, JPG and PNG documents are allowed',
      ),
      false,
    );
  }
}

function generateFilename(file: Express.Multer.File): string {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, KycApprovedGuard)
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<Response> {
    const project = await this.projectsService.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      goalAmount: dto.goalAmount,
      currency: dto.currency,
      stellarAddress: dto.stellarAddress,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      ownerId: user.sub,
    });

    return sendSuccess(res, project, 'Project created successfully', HttpStatus.CREATED);
  }

  @Post(':id/cover-image')
  @UseGuards(JwtAuthGuard, ProjectOwnerOrAdminGuard)
  @UseInterceptors(
    FileInterceptor('coverImage', {
      storage: diskStorage({
        destination: './uploads/projects/cover-images',
        filename: (_req, file, cb) => cb(null, generateFilename(file)),
      }),
      fileFilter: coverImageFileFilter,
    }),
  )
  async uploadCoverImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ): Promise<Response> {
    if (!file) {
      throw new BadRequestException('Cover image is required');
    }
    if (file.size > COVER_IMAGE_MAX_SIZE) {
      throw new BadRequestException('Cover image must not exceed 5MB');
    }

    const project = await this.projectsService.updateCoverImage(id, file.path);
    return sendSuccess(res, project, 'Cover image uploaded successfully');
  }

  @Post(':id/documents')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  @UseInterceptors(
    FilesInterceptor('documents', MAX_DOCUMENTS, {
      storage: diskStorage({
        destination: './uploads/projects/documents',
        filename: (_req, file, cb) => cb(null, generateFilename(file)),
      }),
      fileFilter: documentFileFilter,
    }),
  )
  async uploadDocuments(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ): Promise<Response> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one document is required');
    }

    for (const file of files) {
      if (file.size > DOCUMENT_MAX_SIZE) {
        throw new BadRequestException(
          `Document ${file.originalname} must not exceed 10MB`,
        );
      }
    }

    const paths = files.map((file) => file.path);
    const project = await this.projectsService.appendDocuments(id, paths);
    return sendSuccess(res, project, 'Documents uploaded successfully');
  }
}
