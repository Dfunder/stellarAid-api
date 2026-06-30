import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument, ProjectStatus } from '../models/project.model';

export interface CreateProjectInput {
  title: string;
  description: string;
  category: string;
  goalAmount: number;
  currency?: string;
  stellarAddress: string;
  startDate: Date;
  endDate: Date;
  ownerId: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
  ) {}

  async create(input: CreateProjectInput): Promise<ProjectDocument> {
    const project = await this.projectModel.create({
      title: input.title,
      description: input.description,
      category: input.category,
      goalAmount: input.goalAmount,
      currency: input.currency ?? 'XLM',
      stellarAddress: input.stellarAddress,
      startDate: input.startDate,
      endDate: input.endDate,
      owner: new Types.ObjectId(input.ownerId),
      status: ProjectStatus.PENDING,
      raisedAmount: 0,
      documents: [],
      coverImage: null,
    });
    return project;
  }

  async findById(id: string): Promise<ProjectDocument | null> {
    return this.projectModel.findById(id).exec();
  }

  async updateCoverImage(id: string, coverImagePath: string): Promise<ProjectDocument> {
    const updated = await this.projectModel
      .findByIdAndUpdate(id, { coverImage: coverImagePath }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Project not found');
    }
    return updated;
  }

  async appendDocuments(id: string, documentPaths: string[]): Promise<ProjectDocument> {
    const updated = await this.projectModel
      .findByIdAndUpdate(id, { $push: { documents: { $each: documentPaths } } }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Project not found');
    }
    return updated;
  }
}
