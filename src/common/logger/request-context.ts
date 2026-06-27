import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { NextFunction, Request, Response } from 'express';

export interface LogRequestContext {
  requestId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<LogRequestContext>();

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getUserIdFromAuthorizationHeader(header?: string): string | undefined {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const payload = token?.split('.')[1];

  if (!payload) {
    return undefined;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      userId?: string;
      id?: string;
    };

    return decoded.sub ?? decoded.userId ?? decoded.id;
  } catch {
    return undefined;
  }
}

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = getHeaderValue(request.headers['x-request-id']) ?? randomUUID();
  const userId = getUserIdFromAuthorizationHeader(request.headers.authorization);

  response.setHeader('x-request-id', requestId);
  storage.run({ requestId, userId }, next);
}

export function getLogRequestContext(): LogRequestContext | undefined {
  return storage.getStore();
}
