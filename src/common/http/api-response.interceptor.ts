import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { successResponse } from './api-response';
import {
  DEPRECATED_KEY,
  DeprecationInfo,
} from '../decorators/deprecated.decorator';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const deprecationInfo = this.reflector.get<DeprecationInfo>(
      DEPRECATED_KEY,
      context.getHandler(),
    );

    if (deprecationInfo) {
      response.setHeader('Deprecation', 'true');
      response.setHeader('Sunset', deprecationInfo.sunset);
      response.setHeader(
        'Link',
        `<${deprecationInfo.migration}>; rel="deprecation"`,
      );
    }

    return next.handle().pipe(
      map((body: unknown) => {
        if (
          request.method === 'HEAD' ||
          response.statusCode === 204 ||
          response.statusCode === 304 ||
          body === undefined ||
          body === null ||
          (typeof body === 'object' &&
            body !== null &&
            'status' in body &&
            (body as { status?: unknown }).status === 'success')
        ) {
          return body;
        }

        return successResponse(body);
      }),
    );
  }
}
