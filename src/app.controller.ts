import { Controller, Get, Req, Res } from '@nestjs/common';
import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService, type HelloResponse } from './app.service';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';

@Controller()
@ApiTags('app')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
