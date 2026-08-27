import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { getRequestId } from '../request-context/request-context';

/**
 * Emits one structured log line per HTTP request containing the request id,
 * method, path, status and duration. Registered globally so successful and
 * failed requests alike leave a traceable entry that correlates with every
 * other log line written while the request was handled.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    const logRequest = (statusCode: number) => {
      this.logger.log({
        requestId: getRequestId(),
        method: request.method,
        path: request.originalUrl,
        statusCode,
        durationMs: Date.now() - startedAt,
      });
    };

    return next.handle().pipe(
      tap({
        next: () => logRequest(response.statusCode),
        error: (error: unknown) =>
          logRequest(
            error instanceof HttpException ? error.getStatus() : 500,
          ),
      }),
    );
  }
}
