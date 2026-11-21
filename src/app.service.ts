import { Injectable } from '@nestjs/common';

export const DEFAULT_GREETING = 'Hello World!';

export type HelloResponse = string;

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
