# Error responses and validation

## Error envelope

Every API error includes the HTTP status, a stable machine-readable code, a human-readable message, request path, and timestamp:

```json
{
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Password must contain at least 8 characters.",
  "path": "/api/v1/auth/password-reset/confirm",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Stable codes

| HTTP status | Code                     |
| ----------- | ------------------------ |
| 400         | `BAD_REQUEST`            |
| 401         | `UNAUTHORIZED`           |
| 403         | `FORBIDDEN`              |
| 404         | `NOT_FOUND`              |
| 405         | `METHOD_NOT_ALLOWED`     |
| 406         | `NOT_ACCEPTABLE`         |
| 409         | `CONFLICT`               |
| 413         | `PAYLOAD_TOO_LARGE`      |
| 415         | `UNSUPPORTED_MEDIA_TYPE` |
| 500         | `INTERNAL_SERVER_ERROR`  |

Keep code values stable. Change or add a code deliberately and document it. Do not use localized text as a code.

## Validation conventions

DTO validation decorators should contain clear, actionable messages that describe what the user must provide:

```ts
import { IsString, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsString({ message: 'Enter a valid password reset token.' })
  token!: string;

  @MinLength(8, { message: 'Password must contain at least 8 characters.' })
  @IsString({ message: 'Enter a valid password.' })
  password!: string;
}
```

Guidelines:

- lead with the required action (`Enter`, `Choose`, `Use`), not implementation details;
- identify the field or value being corrected;
- avoid URLs, internal names, stack traces, or database terms;
- keep wording consistent for the same constraint;
- use `whitelist: true` and `forbidNonWhitelisted: true` through the global validation pipe;
- return `400 BAD_REQUEST` for validation failures;
- keep stable JSON keys and HTTP statuses separate from localized text.
