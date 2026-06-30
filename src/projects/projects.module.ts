import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Project, ProjectSchema } from '../models/project.model';
import { UsersModule } from '../users/users.module';

import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService, MongooseModule],
})
export class ProjectsModule {}
