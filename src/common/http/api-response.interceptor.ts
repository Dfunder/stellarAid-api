import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { successResponse } from './api-response';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((body: unknown) => {
        if (
          request.method === 'HEAD' ||
          response.statusCode === 204 ||
          response.statusCode === 304 ||
          body === undefined ||
          body === null ||
          (typeof body === 'object' && body !== null && 'status' in body &&
            (body as { status?: unknown }).status === 'success')
        ) {
          return body;
        }

        return successResponse(body);
      }),
    );
  }
}
