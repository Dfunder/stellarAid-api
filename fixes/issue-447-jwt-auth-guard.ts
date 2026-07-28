// Fix for #447: a minimal JwtAuthGuard - allows a request through only
// with a valid bearer token, unless the route is marked @Public().
export const IS_PUBLIC_METADATA_KEY = 'isPublic';

export function Public() {
  return { metadataKey: IS_PUBLIC_METADATA_KEY, value: true };
}

export interface AuthorizedRequest {
  headers: { authorization?: string };
}

export function canActivateJwt(
  isPublicRoute: boolean,
  request: AuthorizedRequest,
  verifyJwt: (token: string) => boolean,
): boolean {
  if (isPublicRoute) {
    return true;
  }
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return false;
  }
  return verifyJwt(header.slice('Bearer '.length));
}
