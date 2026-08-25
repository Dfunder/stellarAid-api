# Naming Conventions

These conventions are enforced (as warnings) by the
`@typescript-eslint/naming-convention` rule in `eslint.config.mjs`.

## Rules

| Kind | Convention | Example |
| ---- | ---------- | ------- |
| Classes, interfaces, types, enums | `PascalCase` | `PaymentsService`, `CreateCommissionDto` |
| Methods, functions, variables | `camelCase` | `findByEmail`, `accessToken` |
| Constants (module-level) | `UPPER_CASE` | `MAX_FAILED_ATTEMPTS` |
| Enum members | `UPPER_CASE` or `PascalCase` | `AuditAction.USER_LOGIN` |
| Files | `kebab-case` with a role suffix | `auth.controller.ts`, `wallet-signature.util.ts` |

## Guidelines

- **One class per file**, named after the file's role
  (`*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.module.ts`,
  `*.dto.ts`, `*.guard.ts`).
- **DTOs** end in `Dto`; **guards** in `Guard`; **decorators** are `camelCase`
  factories.
- Avoid abbreviations except well-known ones (`id`, `dto`, `url`).
- Boolean names read as predicates (`isActive`, `hasAccess`).
