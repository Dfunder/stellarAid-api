import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { ServiceListQueryDto } from './query.dto';
import { QueryService } from './query.service';

@ApiTags('query')
@Controller({ version: '1', path: 'query' })
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Get('services')
  @Public()
  @ApiOperation({
    summary:
      'List services with multi-field sorting, filtering, and pagination metadata',
  })
  async services(@Query() query: ServiceListQueryDto) {
    return this.queryService.listServices(query);
  }
}
