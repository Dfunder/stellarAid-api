import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { HelloResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): HelloResponse {
    return this.appService.getHello();
  }
}
