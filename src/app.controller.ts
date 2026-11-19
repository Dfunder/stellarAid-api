import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService, type HelloResponse } from './app.service';

@Controller()
@ApiTags('app')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get the API greeting' })
  @ApiOkResponse({
    description: 'The current API greeting.',
    schema: { type: 'string', example: 'Hello World!' },
  })
  getHello(): HelloResponse {
    return this.appService.getHello();
  }
}
