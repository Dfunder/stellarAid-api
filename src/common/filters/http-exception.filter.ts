import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getRequestId } from '../request-context/request-context';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    let message: string | string[];

    if (
      typeof errorResponse === 'object' &&
      errorResponse !== null &&
      'message' in errorResponse
    ) {
      message = (errorResponse as { message: string | string[] }).message;
    } else {
      message = errorResponse as string | string[];
    }

    response.status(status).json({
      statusCode: status,
      message: message,
      error: exception.name,
      requestId: getRequestId(),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
