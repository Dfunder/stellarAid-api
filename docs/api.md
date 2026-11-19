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
