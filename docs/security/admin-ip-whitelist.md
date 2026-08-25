# Admin IP Whitelisting

Admin endpoints (`/admin/*`) are additionally protected by `IpWhitelistGuard`
(`src/common/guards/ip-whitelist.guard.ts`), which runs after JWT and role
checks.

## Configuration

Set the `ADMIN_IP_WHITELIST` environment variable to a comma-separated list of
trusted IP addresses:

```
ADMIN_IP_WHITELIST=203.0.113.10,198.51.100.4
```

- When the variable is **empty or unset**, the guard allows all requests, so the
  control is opt-in and does not interfere with local development or CI.
- When it is set, any request whose client IP is not in the list receives a
  `403 Forbidden`.

## Notes

- Place the app behind a trusted proxy and ensure the real client IP is
  forwarded so the guard evaluates the correct address.
- Combine with the existing `JwtAuthGuard` and `RolesGuard` (role-based access);
  IP whitelisting is a defence-in-depth layer, not a replacement for them.
