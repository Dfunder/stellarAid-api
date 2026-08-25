# JWT Expiration & Refresh Strategy

## Tokens

- **Access token** — short-lived, sent as a Bearer token on every request.
  Default lifetime `15m`, configurable via `JWT_EXPIRES_IN`.
- **Refresh token** — long-lived, used only to obtain a new access token.
  Default lifetime `7d`, configurable via `JWT_REFRESH_EXPIRES_IN`.

## Refresh flow

1. On login the API returns an access token and a refresh token.
2. When the access token expires the client calls `POST /auth/refresh` with the
   refresh token.
3. The server validates the refresh token, then issues a **new** access token
   and a **new** refresh token (rotation), invalidating the previous refresh
   token so a leaked token cannot be reused.

## Configuration

```
JWT_SECRET=<secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Keeping the access token short-lived limits the blast radius of a stolen token,
while refresh-token rotation provides reuse detection.
