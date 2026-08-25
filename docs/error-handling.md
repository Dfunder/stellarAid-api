# Error Handling

Errors are handled consistently across modules using typed exception classes and
a single global exception filter.

## Exception classes

Throw the typed exceptions from `src/common/exceptions/app-exceptions.ts` instead
of ad-hoc `HttpException`s:

| Exception | Status | `errorCode` |
| --------- | ------ | ----------- |
| `ResourceNotFoundException` | 404 | `RESOURCE_NOT_FOUND` |
| `ValidationException` | 400 | `VALIDATION_ERROR` |
| `UnauthorizedException` | 401 | `UNAUTHORIZED` |
| `ForbiddenException` | 403 | `FORBIDDEN` |
| `ConflictException` | 409 | `CONFLICT` |

## Standard response shape

The global `HttpExceptionFilter` (`src/common/filters/http-exception.filter.ts`)
serializes every error to:

```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Commission not found"
}
```

## Guidelines

- Use the most specific exception; add a new subclass rather than reusing a
  loosely-fitting one.
- Keep `message` safe for clients — never leak stack traces or internal detail.
- The `errorCode` is stable and machine-readable; clients branch on it, not on
  the human message.
