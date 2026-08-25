import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

interface RequestWithIp {
  ip?: string;
  socket?: { remoteAddress?: string };
}

/**
 * Restricts access to routes it guards to a configured set of trusted IPs.
 *
 * The allowlist is read from the `ADMIN_IP_WHITELIST` environment variable as a
 * comma-separated list of IP addresses. When the variable is empty or unset the
 * guard allows the request, so the control is opt-in and does not break local
 * development. See `docs/security/admin-ip-whitelist.md`.
 */
@Injectable()
export class IpWhitelistGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const raw = process.env.ADMIN_IP_WHITELIST;
    if (!raw || raw.trim() === '') {
      return true;
    }

    const allowed = raw
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

    const request = context.switchToHttp().getRequest<RequestWithIp>();
    const clientIp = (request.ip || request.socket?.remoteAddress || '').replace(
      '::ffff:',
      '',
    );

    if (!allowed.includes(clientIp)) {
      throw new ForbiddenException('Access denied: IP address is not whitelisted');
    }

    return true;
  }
}
