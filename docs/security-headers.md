# Security headers

The API sends security headers on every response, including error responses, using [Helmet](https://helmetjs.github.io/). The setup lives in `src/common/security/security-headers.ts` and is enabled first in `configureApp` (`src/app.setup.ts`), which `src/main.ts` calls on startup.

## Policies

Two Content Security Policy (CSP) profiles are used, chosen by request path.

| Paths                    | Content-Security-Policy                                                                                                                                                                     | Why                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/api/v1/docs` and below | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://validator.swagger.io; connect-src 'self'; object-src 'none'; frame-ancestors 'none'` | Swagger UI loads its own scripts and styles, uses inline styles, and shows `data:` images.     |
| everything else          | `default-src 'none'; frame-ancestors 'none'`                                                                                                                                                | JSON responses are never rendered as a page, so the browser is told to load nothing from them. |

Helmet's other defaults apply to both, for example `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, and `X-Frame-Options`. Two choices differ from the defaults:

- `Cross-Origin-Resource-Policy` is `cross-origin`, because the API is meant to be read by browser clients on other origins (see `CORS_ORIGIN` in the README).
- `upgrade-insecure-requests` is not sent, so Swagger UI keeps working over plain HTTP during local development.

Helmet also removes the `X-Powered-By` header.

## Changing the policy

- Keep the docs policy as narrow as Swagger UI allows. The e2e test `uses a policy Swagger UI can run under on the docs pages` fails if the docs page starts using inline scripts, which `script-src 'self'` would block.
- If a new browser client needs another origin, prefer a specific source in the relevant `directives` list over weakening `default-src`.
- `Strict-Transport-Security` is ignored by browsers over plain HTTP, so it has no effect locally. In production, terminate TLS in front of the app and forward the original scheme.

## Verifying

```bash
curl --silent --head --header 'Accept: application/json' http://localhost:3000/api/v1/
```

Expected headers include `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security`, and no `X-Powered-By`.
