import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BatchService } from './batch.service';
import { BatchRequestDto } from './dto/batch.dto';

@ApiTags('batch')
@Controller({ version: '1', path: 'batch' })
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute up to 50 independent allowlisted operations' })
  execute(@Body() request: BatchRequestDto) {
    return this.batchService.execute(request);
  }
}
