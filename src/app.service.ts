import { Injectable } from '@nestjs/common';

export type HelloResponse = string;

@Injectable()
export class AppService {
  getHello(): HelloResponse {
    return 'Hello World!';
  }
}
