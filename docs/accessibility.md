# Inclusive API design guidelines

This project serves browser, mobile, command-line, and server-side clients. API contracts should be predictable and usable without special knowledge of an implementation.

## Naming and structure

- Use clear, consistent resource names and action names. Prefer `campaigns`, `donations`, and `confirm`, not abbreviations or internal table names.
- Keep JSON field names in lower camel case, and use the same meaning for the same field across endpoints.
- Represent missing optional data as `null` only when it is intentional; omit fields that do not apply, and document both cases.
- Use ISO 8601 UTC strings with a `Z` suffix for timestamps. Use stable identifiers that clients do not need to parse.
- Use pagination, sorting, and filtering names consistently. Document limits and the shape of list responses before a list endpoint becomes public.
- List responses must use the standard pagination shape in [`api.md`](./api.md#pagination): explicit `limit`, `offset`, `count`, `hasNext`, `hasPrevious`, `nextOffset`, `previousOffset` and `total` fields, with `null` (never an omitted field) for anything that does not apply. Clients, including screen readers and other assistive tools, can then announce "showing 3 to 4, more available" without guessing.

## Errors and response status

- Return an appropriate HTTP status plus the existing JSON error envelope: `statusCode`, `message`, `path`, and `timestamp`.
- Put actionable, stable information in `message`. Avoid stack traces, secrets, database errors, and implementation-specific text.
- Do not vary capitalization or punctuation for identical validation failures.
- Validate all client input and identify the affected field when possible. Preserve status codes: `400` for invalid input, `401` for missing/invalid authentication, `403` for authorization failures, `404` for absent resources, `409` for conflicts, and `415` for unsupported media types.
- Keep status and payload behavior consistent in success responses. Document `204` responses as having no response body.

## Internationalization and accessibility

- Keep API identifiers and keys language-neutral. Do not embed a localized sentence in a field name or enum value.
- If user-facing messages are localized later, return a stable error code and expose localized text in a separate field or supported localization mechanism; do not translate `statusCode` or JSON keys.
- Do not rely on color, emoji, or a human to interpret a value. Use explicit fields such as `verified` or `status`.
- Keep enum values self-describing and include the complete allowed set in API documentation.
- Make generated Swagger content and README examples useful to screen-reader users: use headings, plain language, and meaningful descriptions rather than screenshots alone.

## Content and interoperability

- Send JSON as `application/json; charset=utf-8` and accept JSON request bodies with `application/json` or a `+json` media type.
- Use `Accept: application/json` for clients that require an explicit representation, and set `Content-Type: application/json` on JSON request bodies.
- Return validation and parse errors as JSON with the same envelope whenever possible.
- Preserve the `/api/v1` prefix. Future versions should use `/api/v2`, not incompatible changes under an existing version.
