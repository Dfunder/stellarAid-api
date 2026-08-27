import type { NextFunction, Request, Response } from 'express';
import { getRequestId, requestIdMiddleware } from './request-context';

describe('requestIdMiddleware', () => {
  const run = (incoming?: string) => {
    const req = {
      headers: incoming === undefined ? {} : { 'x-request-id': incoming },
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    let observedInContext: string | undefined;
    const next: NextFunction = () => {
      observedInContext = getRequestId();
    };

    requestIdMiddleware(req, res, next);
    return { req, setHeader, observedInContext };
  };

  it('generates a UUID when no X-Request-Id header is supplied', () => {
    const { req, observedInContext } = run();
    const id = (req.headers['x-request-id'] as string) ?? '';
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(observedInContext).toBe(id);
  });

  it('reuses an incoming X-Request-Id so upstream ids correlate', () => {
    const { req, observedInContext } = run('gateway-trace-42');
    expect(req.headers['x-request-id']).toBe('gateway-trace-42');
    expect(observedInContext).toBe('gateway-trace-42');
  });

  it('ignores empty and oversized incoming ids', () => {
    expect(run('   ').observedInContext).not.toBe('   ');
    const oversized = 'x'.repeat(129);
    expect(run(oversized).observedInContext).not.toBe(oversized);
  });

  it('exposes the request id on the response headers', () => {
    const { setHeader } = run('abc-123');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc-123');
  });

  it('does not leak the request id outside the request scope', () => {
    run('scoped-id');
    expect(getRequestId()).toBeUndefined();
  });
});
