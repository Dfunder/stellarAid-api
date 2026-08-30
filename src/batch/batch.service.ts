import { PrismaService case 'update': {
        if (!operation.data || !Array.isArray(operation.data)) {
          throw new Error('Update operation requires a data array.');
        }
        const validatedData = await validateAndTransformArray(
          operation.data,
          UpdateServiceDto,
        );
        const updates = validatedData.map((item) =>
          this.prisma.service.update({
            where: { id: item.id },
            data: item,
          }),
        );
        return this.prisma.$transaction(updates);
      } from 'src/prisma/prisma.service';
import { BatchOperationDto, BatchRequestDto } from './dto/batch.dto';
import {
  validate,
  validateAndTransform,
  validateAndTransformArray,
} from 'src/common/validation/validation.pipe';
import { CreateServiceDto } from 'src/marketplace/dto/create-service.dto';
import { UpdateServiceDto } from 'src/marketplace/dto/update-service.dto';
import { BatchDeleteDto } from './dto/batch-delete.dto';

@Injectable()
export class BatchService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(request: BatchRequestDto) {
    const results = await Promise.all(
      request.operations.map(async (operation) => {
        try {
          const data = await this.executeOperation(operation);
          return {
            id: operation.id,
            status: 'fulfilled' as const,
            data,
          };
        } catch (error) {
          return {
            id: operation.id,
            status: 'rejected' as const,
            error: error instanceof Error ? error.message : 'Operation failed',
          };
        }
      }),
    );
    return {
      total: results.length,
      succeeded: results.filter((result) => result.status === 'fulfilled')
        .length,
      failed: results.filter((result) => result.status === 'rejected').length,
      results,
    };
  }

  private async executeOperation(operation: BatchOperationDto): Promise<any> {
    switch (operation.type) {
      case 'health':
        return { healthy: true };
      case 'insert': {
        if (!operation.data || !Array.isArray(operation.data)) {
          throw new Error('Insert operation requires a data array.');
        }
        const validatedData = await validateAndTransformArray(
          operation.data,
          CreateServiceDto,
        );
        return this.prisma.service.createMany({
          data: validatedData,
          skipDuplicates: true,
        });
      }
      case 'delete': {
        if (!operation.data || !Array.isArray(operation.data)) {
          throw new Error('Delete operation requires a data array.');
        }
        const validatedData = await validateAndTransformArray(
          operation.data,
          BatchDeleteDto,
        );
        const ids = validatedData.map((item) => item.id);
        return this.prisma.service.deleteMany({ where: { id: { in: ids } } });
      }
      default:
        return operation.data ?? {};
    }
  }
}