# API examples

The API is served at `/api/v1`. JSON responses use `Content-Type: application/json; charset=utf-8`; JSON write requests must use `Content-Type: application/json`.

## Greeting

Returns a plain JSON string.

### curl

```bash
curl --fail --show-error --include \
  --header 'Accept: application/json' \
  http://localhost:3000/api/v1/
```

Example successful response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

"Hello World!"
```

### HTTPie

```bash
http GET :3000/api/v1/ Accept:application/json
```

### JavaScript (`fetch`)

```js
const response = await fetch('http://localhost:3000/api/v1/', {
  headers: { Accept: 'application/json' },
});

if (!response.ok) throw new Error(`Request failed: ${response.status}`);
const greeting = await response.json();
console.log(greeting); // Hello World!
```

## Missing route

A missing route uses the consistent error envelope.

```bash
curl --header 'Accept: application/json' \
  http://localhost:3000/api/v1/missing
```

Example response:

```json
{
  "statusCode": 404,
  "message": "Cannot GET /api/v1/missing",
  "path": "/api/v1/missing",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Admin analytics scaffold

This route is intentionally closed until authentication and authorization are configured.

```bash
curl --header 'Accept: application/json' \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  http://localhost:3000/api/v1/admin/analytics
```

Expected response: `401 Unauthorized`. The JSON response may match:

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "path": "/api/v1/admin/analytics",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Password reset confirmation

The write endpoint accepts JSON and returns no body on success (`204 No Content`).

```bash
curl --fail-with-body --request POST \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{"token":"RESET_TOKEN","password":"at-least-8-chars"}' \
  http://localhost:3000/api/v1/auth/password-reset/confirm
```

Invalid input examples:

```json
{
  "statusCode": 400,
  "message": "password must be at least 8 characters",
  "path": "/api/v1/auth/password-reset/confirm",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

A request with a non-JSON body is rejected with `415 Unsupported Media Type`.

## Pagination

List endpoints use offset pagination through `limit` and `offset` query parameters and return one consistent response shape. Helpers live in `src/common/pagination/paginate.ts`.

| Query parameter | Default | Rules                                                            |
| --------------- | ------- | ---------------------------------------------------------------- |
| `limit`         | `20`    | Whole number from `1` to `100`; out-of-range values are clamped. |
| `offset`        | `0`     | Whole number of `0` or more; negative values become `0`.         |

Example request:

```bash
curl --header 'Accept: application/json' \
  'http://localhost:3000/api/v1/campaigns?limit=2&offset=2'
```

Example response (5 matching campaigns, total computed):

```json
{
  "items": [{ "id": "c3" }, { "id": "c4" }],
  "limit": 2,
  "offset": 2,
  "count": 2,
  "hasNext": true,
  "hasPrevious": true,
  "nextOffset": 4,
  "previousOffset": 0,
  "total": 5
}
```

Every field is always present. A field that does not apply is `null`, never omitted.

| Field            | Type             | Meaning                                                                        |
| ---------------- | ---------------- | ------------------------------------------------------------------------------ |
| `items`          | array            | The rows on this page, at most `limit` of them.                                |
| `limit`          | number           | Maximum items requested for this page.                                         |
| `offset`         | number           | Items skipped before the first item on this page.                              |
| `count`          | number           | Items on this page (`items.length`).                                           |
| `hasNext`        | boolean          | `true` when at least one more item exists after this page.                     |
| `hasPrevious`    | boolean          | `true` when `offset` is greater than `0`.                                      |
| `nextOffset`     | number or `null` | `offset` to request for the next page; `null` when `hasNext` is false.         |
| `previousOffset` | number or `null` | `offset` to request for the previous page; `null` when `hasPrevious` is false. |
| `total`          | number or `null` | Items across all pages; `null` when the endpoint does not count them.          |

Clients should follow `nextOffset` and `previousOffset` rather than computing offsets themselves, and should read `hasNext` instead of inferring the end of the list from `count`. When `total` is `null`, show wording such as "more results available" rather than a page count.
