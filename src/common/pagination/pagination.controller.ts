import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { CursorPaginationQueryDto, PaginationQueryDto } from './pagination.dto';
import { PaginationService } from './pagination.service';

@ApiTags('pagination')
@Controller({ version: '1', path: 'pagination' })
export class PaginationController {
  constructor(private readonly paginationService: PaginationService) {}

  @Get('services')
  @Public()
  @ApiOperation({ summary: 'Offset/limit paginated services with total count' })
  async services(@Query() query: PaginationQueryDto) {
    return this.paginationService.paginateServices(query);
  }

  @Get('services/cursor')
  @Public()
  @ApiOperation({ summary: 'Cursor-based paginated services' })
  async servicesCursor(@Query() query: CursorPaginationQueryDto) {
    return this.paginationService.cursorPaginateServices(query);
  }
}
