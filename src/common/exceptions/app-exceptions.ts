import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Standard error response shape returned by the API. The global exception
 * filter serializes every error to this structure so clients get a consistent
 * body regardless of where the error originated.
 */
export interface AppErrorBody {
  statusCode: number;
  /** Stable, machine-readable error code (e.g. `RESOURCE_NOT_FOUND`). */
  errorCode: string;
  /** Human-readable message safe to show to the client. */
  message: string;
}

/**
 * Base application exception. Prefer the typed subclasses below; use this
 * directly only for one-off cases.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly errorCode: string,
    message: string,
  ) {
    super({ statusCode: status, errorCode, message } as AppErrorBody, status);
  }
}

/** 404 – a requested resource does not exist. */
export class ResourceNotFoundException extends AppException {
  constructor(message = 'Resource not found') {
    super(HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND', message);
  }
}

/** 400 – the request failed a business/validation rule. */
export class ValidationException extends AppException {
  constructor(message = 'Validation failed') {
    super(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message);
  }
}

/** 401 – the caller is not authenticated. */
export class UnauthorizedException extends AppException {
  constructor(message = 'Authentication required') {
    super(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', message);
  }
}

/** 403 – the caller is authenticated but not permitted. */
export class ForbiddenException extends AppException {
  constructor(message = 'You do not have permission to perform this action') {
    super(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
  }
}

/** 409 – the request conflicts with current state. */
export class ConflictException extends AppException {
  constructor(message = 'Resource conflict') {
    super(HttpStatus.CONFLICT, 'CONFLICT', message);
  }
}
