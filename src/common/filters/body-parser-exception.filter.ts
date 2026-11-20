import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { errorCodeForStatus } from './error-code';

interface BodyParserError {
  type?: string;
  status?: number;
  message?: string;
}

/**
 * body-parser failures carry a string `type` and an HTTP-ish `status`, but are
 * not `HttpException`s, so Nest would otherwise answer 500.
 */
export const STATUS_BY_TYPE: Record<string, number> = {
  'entity.parse.failed': HttpStatus.BAD_REQUEST,
  'entity.verify.failed': HttpStatus.BAD_REQUEST,
  'request.aborted': HttpStatus.BAD_REQUEST,
  'request.size.invalid': HttpStatus.BAD_REQUEST,
  'entity.too.large': HttpStatus.PAYLOAD_TOO_LARGE,
  'charset.unsupported': HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  'encoding.unsupported': HttpStatus.UNSUPPORTED_MEDIA_TYPE,
};

export function getBodyParserStatus(type: string): number {
  return STATUS_BY_TYPE[type] ?? HttpStatus.BAD_REQUEST;
}

export function isBodyParserError(error: unknown): error is BodyParserError {
  if (typeof error !== 'object' || error === null) return false;
  const type = (error as BodyParserError).type;
  return typeof type === 'string' && type in STATUS_BY_TYPE;
}

@Catch()
export class BodyParserExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        ...((typeof exception.getResponse() === 'object'
          ? exception.getResponse()
          : { message: exception.message }) as object),
        statusCode: status,
        code: errorCodeForStatus(status),
      });
      return;
    }

    if (!isBodyParserError(exception)) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      });
      return;
    }

    const statusCode = getBodyParserStatus(exception.type as string);
    response.status(statusCode).json({
      statusCode,
      code: errorCodeForStatus(statusCode),
      message: exception.message ?? 'Invalid request body',
    });
  }
}
