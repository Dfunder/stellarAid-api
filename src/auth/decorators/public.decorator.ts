import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route or controller as not requiring authentication.
 *
 * Combine with the project's `JwtAuthGuard` (which checks for this
 * metadata via `Reflector`) so endpoints like `/auth/login` and
 * `/auth/register` stay reachable while private endpoints still get
 * JWT verification.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
