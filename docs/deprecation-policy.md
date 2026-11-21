# API deprecation and change policy

## Scope and versioning

The current public API prefix is `/api/v1`. It is the compatibility boundary for existing clients.

- Add backward-compatible fields and endpoints within the current version.
- Do not remove or rename fields, change status codes, or alter payload meanings inside `/api/v1`.
- Make a breaking change in a new prefix, such as `/api/v2`, and preserve `/api/v1` during its documented deprecation period.
- If there is no consumer impact or security concern, corrections may remain narrow and patch-level; communicate significant behavior changes before rollout.

## Deprecation notice template

A deprecation notice should include:

- the deprecated endpoint or field;
- the replacement endpoint or field;
- the deprecation date;
- the removal date or migration window;
- migration steps and examples;
- a support contact or issue link.

Example:

```text
Deprecated: GET /api/v1/example
Replacement: GET /api/v2/example
Deprecated on: 2026-07-01
Removal target: 2027-01-01
Migration: use the `items` array returned by the replacement and send Accept: application/json.
Tracking: https://github.com/Dfunder/stellarAid-api/issues/0000
```

## Response headers

When a route or field is deprecated, implementations should add:

- `Deprecation: true` or an RFC 8594-style timestamp where tooling supports it;
- `Sunset: <HTTP-date>` for the planned removal date;
- `Link: </api/v2/example>; rel="successor-version"` for an exact replacement;
- optionally `Warning: 299 - "Deprecated API; migrate to ..."` for added human-readable context.

The headers describe a deprecation, not a change in the response body. The existing JSON success and error shapes continue until removal.

## Change communication

- Announce deprecations in the changelog or release notes before the Sunset date.
- Keep at least a practical six-month migration window for breaking changes. Security fixes or clearly unavoidable legal changes may require faster action and should explain why.
- Provide copy-paste migration examples and update Swagger/OpenAPI plus `docs/api.md` together.
- Test both the deprecated and replacement behavior while the migration window is open.
- Remove a route or field only after its Sunset date and only according to the version policy above.

## Documentation checklist

Before merging a deprecation:

- [ ] endpoint or field and replacement are named clearly;
- [ ] deprecation and removal dates are documented;
- [ ] response headers are implemented consistently;
- [ ] examples and error conventions are updated;
- [ ] tests cover behavior through the migration window;
- [ ] the API documentation identifies the status as deprecated.
