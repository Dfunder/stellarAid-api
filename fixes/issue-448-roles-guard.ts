// Fix for #448: a minimal RolesGuard - reads roles set via a @Roles(...)
// decorator's metadata key and checks them against req.user.role.
export const ROLES_METADATA_KEY = 'roles';

export function Roles(...roles: string[]) {
  return { metadataKey: ROLES_METADATA_KEY, roles };
}

export interface RequestWithUser {
  user?: { role: string };
}

export function canActivateWithRoles(
  requiredRoles: string[] | undefined,
  request: RequestWithUser,
): boolean {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  const userRole = request.user?.role;
  if (!userRole) {
    return false;
  }
  return requiredRoles.includes(userRole);
}
