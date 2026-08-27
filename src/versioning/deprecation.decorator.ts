import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_API = 'deprecated_api';

export interface DeprecationInfo {
  /** RFC 1123 date after which the endpoint stops working (Sunset header). */
  sunset?: string;
  /** Human-readable migration guidance. */
  message?: string;
}

/**
 * Marks a route (or controller) as deprecated. The {@link DeprecationInterceptor}
 * emits standard `Deprecation` / `Sunset` response headers for tagged routes.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- decorator factory
export const DeprecatedApi = (info: DeprecationInfo = {}) =>
  SetMetadata(DEPRECATED_API, info);
