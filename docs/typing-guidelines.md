# TypeScript Typing Guidelines

`strict` mode is enabled in `tsconfig.json`. Follow these guidelines so the
codebase stays type-safe.

## Rules

- **No implicit `any`.** Prefer precise types; use `unknown` and narrow when a
  value's type is genuinely dynamic.
- **Null-safety.** `strictNullChecks` is on — handle `null`/`undefined`
  explicitly (optional chaining, guards, or non-null assertions only when
  provably safe).
- **Type external libraries.** Add `@types/*` packages or local `.d.ts`
  declarations for untyped dependencies rather than casting to `any`.
- **Avoid `as any`.** If a cast is unavoidable, cast to the narrowest correct
  type and add a comment explaining why.

## Notes

- `strictPropertyInitialization` is intentionally disabled because NestJS
  DTO/entity classes declare properties that are populated by the framework
  (validation, ORM) rather than in a constructor.
