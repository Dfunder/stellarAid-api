# NestJS Module Structure

Every feature module follows the same file-per-concern layout so modules are
consistent and easy to navigate, test and extend.

## Standard layout

```
src/<feature>/
├── <feature>.module.ts        # wires the module together
├── <feature>.controller.ts    # HTTP layer only (routing, DTO binding)
├── <feature>.service.ts       # business logic
├── <feature>.repository.ts    # data access (Prisma queries)
├── dto/                       # request/response DTOs with validation
│   └── *.dto.ts
└── entities|enums/            # domain types shared within the module
```

## Rules

- **Controllers** contain no business logic — they validate input (via DTOs) and
  delegate to a service.
- **Services** contain business logic and depend on repositories, not on Prisma
  directly (see the repository pattern).
- **Repositories** encapsulate all persistence for an entity.
- **DTOs** exist for every request body and, where useful, response shape, and
  carry `class-validator` decorators.
- Cross-cutting helpers (guards, filters, interceptors, utils) live under
  `src/common/`.

## Registration

A module declares its `controllers` and `providers` and `exports` only what
other modules need, keeping internal wiring encapsulated.
