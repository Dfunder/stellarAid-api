import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getRequestId } from '../request-context/request-context';
import { AppException } from '../exceptions/app-exceptions';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : 500;
    const errorResponse = isHttpException ? exception.getResponse() : undefined;

    let message: string | string[] = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (
      typeof errorResponse === 'object' &&
      errorResponse !== null &&
      'message' in errorResponse
    ) {
      message = (errorResponse as { message: string | string[] }).message;
    } else if (typeof errorResponse === 'string') {
      message = errorResponse;
    }

    if (exception instanceof AppException) {
      errorCode = exception.errorCode;
    } else if (isHttpException) {
      errorCode = exception.name.toUpperCase().replace(/EXCEPTION$/, '');
      if (status === 400) errorCode = 'VALIDATION_ERROR';
    }

    response.status(status).json({
      status: 'error',
      message: message,
      data: null,
      errorCode,
      requestId: getRequestId(),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
