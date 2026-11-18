import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

interface BodyParserError {
  type?: string;
  status?: number;
  message?: string;
}

/**
 * body-parser failures carry a string `type` and an HTTP-ish `status`, but are
 * not `HttpException`s, so Nest would otherwise answer 500.
 */
const STATUS_BY_TYPE: Record<string, number> = {
  'entity.parse.failed': HttpStatus.BAD_REQUEST,
  'entity.verify.failed': HttpStatus.BAD_REQUEST,
  'request.aborted': HttpStatus.BAD_REQUEST,
  'request.size.invalid': HttpStatus.BAD_REQUEST,
  'entity.too.large': HttpStatus.PAYLOAD_TOO_LARGE,
  'charset.unsupported': HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  'encoding.unsupported': HttpStatus.UNSUPPORTED_MEDIA_TYPE,
};

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
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (!isBodyParserError(exception)) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
      return;
    }

    const statusCode =
      STATUS_BY_TYPE[exception.type as string] ?? HttpStatus.BAD_REQUEST;
    response.status(statusCode).json({
      statusCode,
      message: exception.message ?? 'Invalid request body',
    });
  }
}
