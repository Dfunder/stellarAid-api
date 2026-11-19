import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
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
  getHello(@Res({ passthrough: true }) response?: Response): HelloResponse {
    const greeting = this.appService.getHello();
    if (response) {
      response.status(200).json(greeting);
      return greeting;
    }
    return greeting;
  }
}
