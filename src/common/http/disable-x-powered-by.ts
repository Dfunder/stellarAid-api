import type { INestApplication } from '@nestjs/common';

/**
 * Stops Express from sending the `X-Powered-By` header, which would
 * otherwise leak framework information (fingerprinting).
 */
export function disableXPoweredBy(app: INestApplication): void {
  const instance = app.getHttpAdapter().getInstance() as {
    disable?: (setting: string) => unknown;
  };
  instance.disable?.('x-powered-by');
}
