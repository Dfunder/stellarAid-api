import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtPayload } from '../../auth/guards/jwt-auth.guard';
import { Project, ProjectDocument } from '../../models/project.model';

@Injectable()
export class ProjectOwnerGuard implements CanActivate {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const projectId = request.params.id;
    const userId = request.user.sub;

    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('You do not own this project');
    }

    return true;
  }
}
