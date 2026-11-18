import { Injectable } from '@nestjs/common';

export const DEFAULT_GREETING = 'Hello World!';

@Injectable()
export class AppService {
  getHello(): string {
    return DEFAULT_GREETING;
  }
}
