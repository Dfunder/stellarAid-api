import { Injectable } from '@nestjs/common';
import { BatchOperationDto, BatchRequestDto } from './dto/batch.dto';

@Injectable()
export class BatchService {
  async execute(request: BatchRequestDto) {
    const results = await Promise.all(
      request.operations.map(async (operation) => {
        try {
          return {
            id: operation.id,
            status: 'fulfilled' as const,
            data: this.executeOperation(operation),
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
      succeeded: results.filter((result) => result.status === 'fulfilled').length,
      failed: results.filter((result) => result.status === 'rejected').length,
      results,
    };
  }

  private executeOperation(operation: BatchOperationDto): Record<string, unknown> {
    if (operation.type === 'health') return { healthy: true };
    return operation.data ?? {};
  }
}
