import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
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
  getHello(
    @Req() request?: Request,
    @Res({ passthrough: true }) response?: Response,
  ): HelloResponse | void {
    const greeting = this.appService.getHello();
    if (!request || !response) return greeting;

    const etag = `"${createHash('sha256').update(JSON.stringify(greeting)).digest('base64url')}"`;

    response.setHeader('Cache-Control', 'public, max-age=60');
    response.setHeader('ETag', etag);

    const ifNoneMatch = request.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string') {
      const matches = ifNoneMatch
        .split(',')
        .map((value) => value.trim())
        .some((value) => value === etag || value === '*');
      if (matches) {
        response.status(304).end();
        return;
      }
    }

    response.status(200).json(greeting);
    return;
  }
}
