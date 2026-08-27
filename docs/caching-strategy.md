# Caching Strategy

The API supports client-side caching of read endpoints through HTTP
conditional requests (`ETag` / `If-None-Match`).

## How it works

1. Every `GET`/`HEAD` response that returns `200 OK` with a JSON body is
   assigned a **weak ETag** derived from the serialized response body
   (e.g. `ETag: W/"Ab3xQ..."`).
2. The response also carries `Cache-Control: no-cache` unless a handler
   already set a policy. `no-cache` means browsers/CDNs may store the
   response but **must revalidate** it with the origin before reuse.
3. On the next request, the client sends the stored validator back via
   `If-None-Match: W/"Ab3xQ..."`.
4. If the current body produces the same validator, the API answers
   **`304 Not Modified`** with an empty body, saving bandwidth and
   serialization time. Otherwise a fresh `200` with the new `ETag` is
   returned.

Weak comparison is used (`W/` prefixes are ignored) and wildcard (`*`)
as well as comma-separated candidate lists are honored per RFC 9110.

## Client usage

```http
GET /v1/portfolios HTTP/1.1
```

```http
HTTP/1.1 200 OK
ETag: W/"Ab3xQ0f1T8f3d3h1d3h1d3h1d3h"
Cache-Control: no-cache
```

```http
GET /v1/portfolios HTTP/1.1
If-None-Match: W/"Ab3xQ0f1T8f3d3h1d3h1d3h1d3h"
```

```http
HTTP/1.1 304 Not Modified
ETag: W/"Ab3xQ0f1T8f3d3h1d3h1d3h1d3h"
```

Browser `fetch`/`XMLHttpRequest` do this automatically when the default
cache mode is used; server-to-server clients should store the `ETag`
header and replay it as `If-None-Match`.

## Scope and limitations

- Applied to all successful (`200`) `GET`/`HEAD` JSON responses via a
  global interceptor. Mutating methods (`POST`, `PATCH`, `DELETE`) never
  receive ETags.
- Error responses are not tagged; clients should not cache them.
- Validators are computed per request from the response payload — there
  is no persisted cache layer involved, so correctness is guaranteed at
  the cost of a hash per response.
- Responses already served from the Redis-backed search/featured caches
  benefit the same way: unchanged payloads produce identical ETags.
- CORS exposes `ETag` (and `X-Request-Id`) and allows `If-None-Match`
  so browser clients can participate.
